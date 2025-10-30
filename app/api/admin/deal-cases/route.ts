import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/auth-helpers";
import { dealCaseSchema } from "@/lib/validation/deal-case";
import { getSignedImageUrl } from "@/lib/s3-presign";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

type DealCaseRecord = {
  id: string;
  caseCode: string;
  city: string;
  state: string;
  heroImageUrl: string;
  priceDisplayEn: string;
  priceDisplayZh: string;
  timelineEn: string;
  timelineZh: string;
  borrowerTypeEn: string;
  borrowerTypeZh: string;
  productEn: string;
  productZh: string;
  highlightEn: string;
  highlightZh: string;
  published: boolean;
  createdAt: Date;
  updatedAt: Date;
  images: Array<{
    id: string;
    url: string;
    altEn: string;
    altZh: string;
    sortOrder: number;
  }>;
};

const mapDealCase = async (deal: DealCaseRecord) => {
  const gallery = await Promise.all(
    deal.images.map(async (image) => ({
      id: image.id,
      url: image.url,
      signedUrl: await getSignedImageUrl(image.url),
      alt: {
        en: image.altEn,
        zh: image.altZh
      },
      sortOrder: image.sortOrder
    }))
  );

  return {
    id: deal.id,
    caseCode: deal.caseCode,
    city: deal.city,
    state: deal.state,
    published: deal.published,
    heroImage: {
      url: deal.heroImageUrl,
      signedUrl: await getSignedImageUrl(deal.heroImageUrl)
    },
    price: {
      en: deal.priceDisplayEn,
      zh: deal.priceDisplayZh
    },
    timeline: {
      en: deal.timelineEn,
      zh: deal.timelineZh
    },
    borrowerType: {
      en: deal.borrowerTypeEn,
      zh: deal.borrowerTypeZh
    },
    product: {
      en: deal.productEn,
      zh: deal.productZh
    },
    highlight: {
      en: deal.highlightEn,
      zh: deal.highlightZh
    },
    gallery,
    createdAt: deal.createdAt.toISOString(),
    updatedAt: deal.updatedAt.toISOString()
  };
};

const selectDealCase = {
  id: true,
  caseCode: true,
  city: true,
  state: true,
  heroImageUrl: true,
  priceDisplayEn: true,
  priceDisplayZh: true,
  timelineEn: true,
  timelineZh: true,
  borrowerTypeEn: true,
  borrowerTypeZh: true,
  productEn: true,
  productZh: true,
  highlightEn: true,
  highlightZh: true,
  published: true,
  createdAt: true,
  updatedAt: true,
  images: {
    select: {
      id: true,
      url: true,
      altEn: true,
      altZh: true,
      sortOrder: true
    },
    orderBy: { sortOrder: "asc" as const }
  }
};

export async function GET() {
  const session = await requireAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const cases = await prisma.dealCase.findMany({
    select: selectDealCase,
    orderBy: { createdAt: "desc" }
  });

  const mapped = await Promise.all(cases.map((deal) => mapDealCase(deal as DealCaseRecord)));

  return NextResponse.json({ cases: mapped });
}

export async function POST(request: Request) {
  const session = await requireAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const parsed = dealCaseSchema.safeParse(payload);
  if (!parsed.success) {
    const message = parsed.error.issues.map((issue) => issue.message).join(" | ");
    return NextResponse.json({ error: message || "Invalid deal case payload" }, { status: 400 });
  }

  const data = parsed.data;

  try {
    const created = await prisma.dealCase.create({
      data: {
        caseCode: data.caseCode,
        city: data.city,
        state: data.state,
        heroImageUrl: data.heroImageUrl,
        priceDisplayEn: data.price.en,
        priceDisplayZh: data.price.zh,
        timelineEn: data.timeline.en,
        timelineZh: data.timeline.zh,
        borrowerTypeEn: data.borrowerType.en,
        borrowerTypeZh: data.borrowerType.zh,
        productEn: data.product.en,
        productZh: data.product.zh,
        highlightEn: data.highlight.en,
        highlightZh: data.highlight.zh,
        published: data.published,
        images: {
          create: data.gallery.map((image, index) => ({
            url: image.url,
            altEn: image.alt.en,
            altZh: image.alt.zh,
            sortOrder: image.sortOrder ?? index
          }))
        }
      },
      select: selectDealCase
    });

    const mapped = await mapDealCase(created as DealCaseRecord);
    return NextResponse.json({ case: mapped }, { status: 201 });
  } catch (error) {
    console.error("Failed to create deal case", error);
    return NextResponse.json({ error: "Failed to create deal case" }, { status: 500 });
  }
}
