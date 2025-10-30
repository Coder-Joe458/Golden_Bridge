import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { brokerProfileSchema } from "@/lib/validation/broker-profile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.user.role !== "BROKER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let profile = await prisma.brokerProfile.findUnique({
    where: { userId: session.user.id }
  });

  if (!profile) {
    profile = await prisma.brokerProfile.create({
      data: {
        userId: session.user.id,
        licenseStates: []
      }
    });
  }

  return NextResponse.json({ profile });
}

export async function PUT(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.user.role !== "BROKER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch (error) {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const parsed = brokerProfileSchema.safeParse(payload);
  if (!parsed.success) {
    const messages = parsed.error.issues.map((issue) => issue.message).join(" | ");
    return NextResponse.json({ error: messages || "Invalid broker profile data" }, { status: 400 });
  }

  const data = parsed.data;

  if (data.minRate !== null && data.maxRate !== null && data.minRate > data.maxRate) {
    return NextResponse.json({ error: "Maximum rate must be greater than minimum rate" }, { status: 400 });
  }

  const profile = await prisma.brokerProfile.upsert({
    where: { userId: session.user.id },
    update: {
      company: data.company,
      headline: data.headline,
      bio: data.bio,
      licenseStates: data.licenseStates ?? [],
      yearsExperience: data.yearsExperience,
      website: data.website,
      minRate: data.minRate,
      maxRate: data.maxRate,
      loanPrograms: data.loanPrograms ?? [],
      minCreditScore: data.minCreditScore,
      maxLoanToValue: data.maxLoanToValue,
      notes: data.notes,
      closingSpeedDays: data.closingSpeedDays
    },
    create: {
      userId: session.user.id,
      company: data.company,
      headline: data.headline,
      bio: data.bio,
      licenseStates: data.licenseStates ?? [],
      yearsExperience: data.yearsExperience,
      website: data.website,
      minRate: data.minRate,
      maxRate: data.maxRate,
      loanPrograms: data.loanPrograms ?? [],
      minCreditScore: data.minCreditScore,
      maxLoanToValue: data.maxLoanToValue,
      notes: data.notes,
      closingSpeedDays: data.closingSpeedDays
    }
  });

  return NextResponse.json({ profile });
}
