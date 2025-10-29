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
          email: true,
          phoneNumber: true
        }
      }
    }
  });

  const filteredBrokers =
    state
      ? brokers.filter((broker) => {
          const normalizedStates = (broker.licenseStates ?? []).map((s) => normalizeState(s));
          if (!normalizedStates.length) return false;
          return normalizedStates.includes(state);
        })
      : brokers;

  const pool = (filteredBrokers.length ? filteredBrokers : brokers).filter((broker) => {
    if (creditScore && broker.minCreditScore && creditScore < broker.minCreditScore) {
      return false;
    }
    return true;
  });

  const basePool = pool.length ? pool : filteredBrokers.length ? filteredBrokers : brokers;

  const mapBroker = (broker: typeof basePool[number]) => {
    const normalizedStates = (broker.licenseStates ?? []).map((s) => normalizeState(s) ?? s.toUpperCase());
    return {
      id: broker.id,
      company: broker.company,
      headline: broker.headline,
      notes: broker.notes,
      licenseStates: normalizedStates,
      minRate: broker.minRate ? Number(broker.minRate) : null,
      maxRate: broker.maxRate ? Number(broker.maxRate) : null,
      loanPrograms: broker.loanPrograms ?? [],
      minCreditScore: broker.minCreditScore,
      maxLoanToValue: broker.maxLoanToValue,
      yearsExperience: broker.yearsExperience,
      website: broker.website,
      lenderName: broker.company || broker.user?.name || "Golden Bridge Broker",
      contactEmail: broker.user?.email ?? null,
      contactPhone: broker.user?.phoneNumber ?? null,
      closingSpeedDays: broker.closingSpeedDays ?? null
    };
  };

  const used = new Set<string>();
  const variantSeed = Math.max(variant, 0);
  const picks: Array<{ category: "lowestRate" | "highestLtv" | "fastestClosing" | "additional"; broker: typeof basePool[number] }> = [];

  const select = (
    category: "lowestRate" | "highestLtv" | "fastestClosing" | "additional",
    sorter: (a: typeof basePool[number], b: typeof basePool[number]) => number,
    predicate?: (broker: typeof basePool[number]) => boolean,
    offsetIndex = 0
  ) => {
    const sorted = [...basePool].sort(sorter);
    const length = sorted.length;
    if (!length) return;
    const offset = ((variantSeed * 7 + offsetIndex * 13) % length + length) % length;
    for (let attempt = 0; attempt < length; attempt++) {
      const broker = sorted[(offset + attempt) % length];
      if (used.has(broker.id)) {
        continue;
      }
      if (predicate && !predicate(broker)) {
        continue;
      }
      picks.push({ category, broker });
      used.add(broker.id);
      break;
    }
  };

  const rateSorter = (a: typeof basePool[number], b: typeof basePool[number]) => {
    const aRate = a.minRate ? Number(a.minRate) : a.maxRate ? Number(a.maxRate) : Number.POSITIVE_INFINITY;
    const bRate = b.minRate ? Number(b.minRate) : b.maxRate ? Number(b.maxRate) : Number.POSITIVE_INFINITY;
    return aRate - bRate;
  };

  const ltvSorter = (a: typeof basePool[number], b: typeof basePool[number]) => {
    const aLtv = a.maxLoanToValue ?? -Infinity;
    const bLtv = b.maxLoanToValue ?? -Infinity;
    return bLtv - aLtv;
  };

  const closingScore = (broker: typeof basePool[number]) => {
    if (broker.closingSpeedDays) return broker.closingSpeedDays;
    const notes = broker.notes?.toLowerCase() ?? "";
    if (/fast|quick|expedited|12\s*day|close/.test(notes)) return 45;
    return 120;
  };

  const closingSorter = (a: typeof basePool[number], b: typeof basePool[number]) => closingScore(a) - closingScore(b);

  select("lowestRate", rateSorter, (broker) => broker.minRate !== null || broker.maxRate !== null, 0);
  select("highestLtv", ltvSorter, (broker) => broker.maxLoanToValue !== null, 1);
  select("fastestClosing", closingSorter, () => true, 2);

  if (picks.length < 3) {
    const fillerSorter = (a: typeof basePool[number], b: typeof basePool[number]) => {
      const aRate = a.minRate ? Number(a.minRate) : Number.POSITIVE_INFINITY;
      const bRate = b.minRate ? Number(b.minRate) : Number.POSITIVE_INFINITY;
      if (aRate === bRate) {
        return (b.maxLoanToValue ?? 0) - (a.maxLoanToValue ?? 0);
      }
      return aRate - bRate;
    };
    while (picks.length < 3) {
      const sorted = [...basePool].sort(fillerSorter);
      if (!sorted.length) break;
      const length = sorted.length;
      const offset = ((variantSeed * 11 + picks.length * 19) % length + length) % length;
      let added = false;
      for (let attempt = 0; attempt < length; attempt++) {
        const broker = sorted[(offset + attempt) % length];
        if (used.has(broker.id)) continue;
        picks.push({ category: "additional", broker });
        used.add(broker.id);
        added = true;
        break;
      }
      if (!added) break;
    }
  }

  const recommendations = picks.map(({ category, broker }) => ({ category, ...mapBroker(broker) }));

  return NextResponse.json({
    recommendations,
    total: basePool.length
  });
}
