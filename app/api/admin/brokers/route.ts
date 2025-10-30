import bcrypt from "bcryptjs";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/auth-helpers";
import { adminCreateBrokerSchema } from "@/lib/validation/broker-profile";
import { NextResponse } from "next/server";

const brokerSelect = {
  id: true,
  name: true,
  email: true,
  phoneNumber: true,
  createdAt: true,
  brokerProfile: {
    select: {
      id: true,
      company: true,
      headline: true,
      bio: true,
      licenseStates: true,
      yearsExperience: true,
      website: true,
      minRate: true,
      maxRate: true,
      loanPrograms: true,
      minCreditScore: true,
      maxLoanToValue: true,
      notes: true,
      closingSpeedDays: true,
      updatedAt: true
    }
  }
} as const;

type BrokerRecord = Prisma.UserGetPayload<{ select: typeof brokerSelect }>;

const mapBroker = (broker: BrokerRecord) => ({
  id: broker.id,
  name: broker.name,
  email: broker.email,
  phoneNumber: broker.phoneNumber,
  createdAt: broker.createdAt.toISOString(),
  profile: broker.brokerProfile
    ? {
        id: broker.brokerProfile.id,
        company: broker.brokerProfile.company,
        headline: broker.brokerProfile.headline,
        bio: broker.brokerProfile.bio,
        licenseStates: broker.brokerProfile.licenseStates,
        yearsExperience: broker.brokerProfile.yearsExperience,
        website: broker.brokerProfile.website,
        minRate: broker.brokerProfile.minRate ? Number(broker.brokerProfile.minRate) : null,
        maxRate: broker.brokerProfile.maxRate ? Number(broker.brokerProfile.maxRate) : null,
        loanPrograms: broker.brokerProfile.loanPrograms,
        minCreditScore: broker.brokerProfile.minCreditScore,
        maxLoanToValue: broker.brokerProfile.maxLoanToValue,
        notes: broker.brokerProfile.notes,
        closingSpeedDays: broker.brokerProfile.closingSpeedDays,
        updatedAt: broker.brokerProfile.updatedAt.toISOString()
      }
    : null
});

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export async function GET() {
  const session = await requireAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const brokers = await prisma.user.findMany({
    where: { role: "BROKER" },
    orderBy: { createdAt: "desc" },
    select: brokerSelect
  });

  return NextResponse.json({ brokers: brokers.map(mapBroker) });
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

  const parsed = adminCreateBrokerSchema.safeParse(payload);
  if (!parsed.success) {
    const message = parsed.error.issues.map((issue) => issue.message).join(" | ");
    return NextResponse.json({ error: message || "Invalid broker payload" }, { status: 400 });
  }

  const data = parsed.data;

  const uniqueConditions: Array<{ email?: string; phoneNumber?: string }> = [{ email: data.email }];
  if (data.phoneNumber) {
    uniqueConditions.push({ phoneNumber: data.phoneNumber });
  }

  const exists = await prisma.user.findFirst({
    where: {
      OR: uniqueConditions
    }
  });

  if (exists) {
    return NextResponse.json({ error: "Email or phone already in use" }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(data.password, 12);

  const profileInput = data.profile ?? {
    company: null,
    headline: null,
    bio: null,
    licenseStates: [],
    yearsExperience: null,
    website: null,
    minRate: null,
    maxRate: null,
    loanPrograms: [] as string[],
    minCreditScore: null,
    maxLoanToValue: null,
    notes: null,
    closingSpeedDays: null
  };

  try {
    const created = await prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        phoneNumber: data.phoneNumber,
        role: "BROKER",
        passwordHash,
        brokerProfile: {
          create: {
            company: profileInput.company ?? null,
            headline: profileInput.headline ?? null,
            bio: profileInput.bio ?? null,
            licenseStates: profileInput.licenseStates ?? [],
            yearsExperience: profileInput.yearsExperience ?? null,
            website: profileInput.website ?? null,
            minRate: profileInput.minRate ?? null,
            maxRate: profileInput.maxRate ?? null,
            loanPrograms: profileInput.loanPrograms ?? [],
            minCreditScore: profileInput.minCreditScore ?? null,
            maxLoanToValue: profileInput.maxLoanToValue ?? null,
            notes: profileInput.notes ?? null,
            closingSpeedDays: profileInput.closingSpeedDays ?? null
          }
        }
      },
      select: brokerSelect
    });

    return NextResponse.json({ broker: mapBroker(created as BrokerRecord) }, { status: 201 });
  } catch (error) {
    console.error("Failed to create broker", error);
    return NextResponse.json({ error: "Failed to create broker" }, { status: 500 });
  }
}
