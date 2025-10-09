import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { extractStateFromLocation, normalizeState } from "@/lib/state-utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

const requestSchema = z.object({
  summary: z
    .object({
      location: z.string().optional().nullable(),
      priority: z.enum(["rate", "ltv", "speed", "documents"]).optional().nullable(),
      credit: z.string().optional().nullable(),
      amount: z.number().optional().nullable()
    })
    .optional()
    .default({}),
  variant: z.number().int().min(0).optional().default(0)
});

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch (error) {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(payload);
  if (!parsed.success) {
    const message = parsed.error.issues.map((issue) => issue.message).join(" | ") || "Invalid request payload";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const { summary, variant } = parsed.data;

  const state = extractStateFromLocation(summary.location ?? undefined);
  const creditScore = summary.credit ? Number.parseInt(summary.credit, 10) : undefined;
  const loanAmount = summary.amount ?? undefined;
  const priority = summary.priority ?? undefined;

  const brokers = await prisma.brokerProfile.findMany({
    include: {
      user: {
        select: {
          name: true,
          email: true
        }
      }
    }
  });

  const scored = brokers
    .map((broker) => {
      if (creditScore && broker.minCreditScore && creditScore < broker.minCreditScore) {
        return null;
      }

      let score = 0;
      const normalizedState = state ? state : null;
      const brokerStates = (broker.licenseStates ?? []).map((s) => normalizeState(s) ?? s.toUpperCase());

      if (normalizedState) {
        if (brokerStates.includes(normalizedState)) {
          score += 60;
        } else if (brokerStates.length === 0) {
          score += 10;
        } else {
          score -= 40;
        }
      }

      if (priority === "rate") {
        if (broker.minRate) {
          score += 40 - Number(broker.minRate);
        }
        if (broker.maxRate) {
          score += 20 - Number(broker.maxRate);
        }
      }

      if (priority === "ltv") {
        if (broker.maxLoanToValue) {
          score += broker.maxLoanToValue;
        }
      }

      if (priority === "documents") {
        const notes = broker.notes?.toLowerCase() ?? "";
        if (/low doc|no doc|minimal|streamlined/.test(notes)) {
          score += 30;
        }
      }

      if (priority === "speed") {
        const notes = broker.notes?.toLowerCase() ?? "";
        if (/fast|quick|expedited|close/.test(notes)) {
          score += 25;
        }
      }

      if (loanAmount && broker.loanPrograms?.length) {
        if (loanAmount > 1_000_000 && broker.loanPrograms.some((program) => /jumbo/i.test(program))) {
          score += 15;
        }
        if (loanAmount < 400_000 && broker.loanPrograms.some((program) => /first|starter|fha|va/i.test(program))) {
          score += 10;
        }
      }

      if (!priority) {
        if (broker.minRate && broker.maxRate) score += 10;
        if (broker.loanPrograms?.length) score += 10;
        if (broker.notes) score += 5;
      }

      const lenderName = broker.company || broker.user?.name || "Golden Bridge Broker";

      return {
        id: broker.id,
        company: broker.company,
        headline: broker.headline,
        notes: broker.notes,
        licenseStates: brokerStates,
        minRate: broker.minRate ? Number(broker.minRate) : null,
        maxRate: broker.maxRate ? Number(broker.maxRate) : null,
        loanPrograms: broker.loanPrograms ?? [],
        minCreditScore: broker.minCreditScore,
        maxLoanToValue: broker.maxLoanToValue,
        yearsExperience: broker.yearsExperience,
        website: broker.website,
        lenderName,
        contactEmail: broker.user?.email ?? null,
        score
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)
    .filter((item) => item.score > -40);

  const sorted = scored.sort((a, b) => b.score - a.score);

  const pageSize = 3;
  const offset = variant * pageSize;
  let page = sorted.slice(offset, offset + pageSize);
  if (page.length < pageSize) {
    page = sorted.slice(0, pageSize);
  }

  return NextResponse.json({
    recommendations: page,
    total: sorted.length
  });
}
