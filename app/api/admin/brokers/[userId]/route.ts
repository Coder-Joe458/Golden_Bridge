import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/auth-helpers";
import { brokerProfileSchema } from "@/lib/validation/broker-profile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export async function PUT(request: Request, { params }: { params: { userId: string } }) {
  const session = await requireAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const user = await prisma.user.findUnique({
    where: { id: params.userId },
    select: { id: true, role: true }
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (user.role !== "BROKER") {
    return NextResponse.json({ error: "Target user is not a broker" }, { status: 400 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const parsed = brokerProfileSchema.safeParse(payload);
  if (!parsed.success) {
    const message = parsed.error.issues.map((issue) => issue.message).join(" | ");
    return NextResponse.json({ error: message || "Invalid broker profile" }, { status: 400 });
  }

  const data = parsed.data;

  if (data.minRate !== null && data.maxRate !== null && data.minRate > data.maxRate) {
    return NextResponse.json({ error: "Maximum rate must be greater than minimum rate" }, { status: 400 });
  }

  try {
    const profile = await prisma.brokerProfile.upsert({
      where: { userId: params.userId },
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
        userId: params.userId,
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

    return NextResponse.json({
      profile: {
        id: profile.id,
        company: profile.company,
        headline: profile.headline,
        bio: profile.bio,
        licenseStates: profile.licenseStates,
        yearsExperience: profile.yearsExperience,
        website: profile.website,
        minRate: profile.minRate ? Number(profile.minRate) : null,
        maxRate: profile.maxRate ? Number(profile.maxRate) : null,
        loanPrograms: profile.loanPrograms,
        minCreditScore: profile.minCreditScore,
        maxLoanToValue: profile.maxLoanToValue,
        notes: profile.notes,
        closingSpeedDays: profile.closingSpeedDays,
        updatedAt: profile.updatedAt.toISOString()
      }
    });
  } catch (error) {
    console.error("Failed to update broker profile", error);
    return NextResponse.json({ error: "Failed to update broker profile" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: { userId: string } }) {
  const session = await requireAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const user = await prisma.user.findUnique({
    where: { id: params.userId },
    select: { id: true, role: true }
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (user.role !== "BROKER") {
    return NextResponse.json({ error: "Target user is not a broker" }, { status: 400 });
  }

  try {
    await prisma.user.delete({ where: { id: params.userId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    console.error("Failed to delete broker", error);
    return NextResponse.json({ error: "Failed to delete broker" }, { status: 500 });
  }
}
