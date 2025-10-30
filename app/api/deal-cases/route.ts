import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSignedImageUrl } from "@/lib/s3-presign";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

const clampLimit = (input: string | null): number | undefined => {
  if (!input) return undefined;
  const parsed = Number.parseInt(input, 10);
  if (Number.isNaN(parsed) || parsed <= 0) return undefined;
  return Math.min(parsed, 24);
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const limit = clampLimit(url.searchParams.get("limit"));

  const where = { published: true };

  const [cases, total] = await Promise.all([
    prisma.dealCase.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        images: {
          orderBy: { sortOrder: "asc" }
        }
      }
    }),
    prisma.dealCase.count({ where })
  ]);

  const normalized = await Promise.all(
    cases.map(async (deal) => {
      const gallery = await Promise.all(
        deal.images.map(async (image) => ({
          src: await getSignedImageUrl(image.url),
          alt: {
            en: image.altEn,
            zh: image.altZh
          }
        }))
      );

      const heroImageAlt = gallery[0]?.alt ?? {
        en: `${deal.city}, ${deal.state}`,
        zh: `${deal.city}（${deal.state}）`
      };

      return {
        id: deal.caseCode,
        city: deal.city,
        state: deal.state,
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
        heroImage: {
          src: await getSignedImageUrl(deal.heroImageUrl),
          alt: heroImageAlt
        },
        gallery
      };
    })
  );

  return NextResponse.json({
    cases: normalized,
    total
  });
}
