import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

const brokerProfileSchema = z.object({
  company: z
    .string()
    .trim()
    .max(120, "Company name is too long")
    .optional()
    .transform((val) => (val && val.length ? val : null)),
  headline: z
    .string()
    .trim()
    .max(160, "Headline is too long")
    .optional()
    .transform((val) => (val && val.length ? val : null)),
  bio: z
    .string()
    .trim()
    .max(2000, "Bio must be under 2000 characters")
    .optional()
    .transform((val) => (val && val.length ? val : null)),
  licenseStates: z
    .array(z.string().trim().regex(/^[A-Za-z]{2}$/u, "Use two-letter state codes"))
    .optional()
    .transform((val) => (val ? val.map((state) => state.toUpperCase()) : [])),
  yearsExperience: z
    .number({ invalid_type_error: "Years of experience must be a number" })
    .int("Years of experience must be an integer")
    .min(0, "Experience cannot be negative")
    .max(80, "Experience seems too high")
    .optional()
    .nullable()
    .transform((val) => (typeof val === "number" ? val : null)),
  website: z
    .string()
    .trim()
    .url("Please provide a valid URL")
    .optional()
    .or(z.literal(""))
    .transform((val) => (val && val.length ? val : null)),
  minRate: z
    .number({ invalid_type_error: "Minimum rate must be a number" })
    .min(0, "Minimum rate must be at least 0")
    .max(99, "Minimum rate is too high")
    .optional()
    .nullable()
    .transform((val) => (typeof val === "number" ? val : null)),
  maxRate: z
    .number({ invalid_type_error: "Maximum rate must be a number" })
    .min(0, "Maximum rate must be at least 0")
    .max(99, "Maximum rate is too high")
    .optional()
    .nullable()
    .transform((val) => (typeof val === "number" ? val : null)),
  loanPrograms: z
    .array(
      z
        .string()
        .trim()
        .min(1, "Loan programme cannot be empty")
        .max(120, "Loan programme description is too long")
    )
    .optional()
    .transform((val) => (val ? val : [])),
  minCreditScore: z
    .number({ invalid_type_error: "Minimum credit score must be a number" })
    .int("Minimum credit score must be an integer")
    .min(300, "Minimum credit score cannot be below 300")
    .max(850, "Minimum credit score cannot exceed 850")
    .optional()
    .nullable()
    .transform((val) => (typeof val === "number" ? val : null)),
  maxLoanToValue: z
    .number({ invalid_type_error: "Maximum LTV must be a number" })
    .int("Maximum LTV must be an integer")
    .min(10, "Maximum LTV should be at least 10")
    .max(100, "Maximum LTV cannot exceed 100")
    .optional()
    .nullable()
    .transform((val) => (typeof val === "number" ? val : null)),
  notes: z
    .string()
    .trim()
    .max(2000, "Notes must be under 2000 characters")
    .optional()
    .transform((val) => (val && val.length ? val : null))
});

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
      notes: data.notes
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
      notes: data.notes
    }
  });

  return NextResponse.json({ profile });
}
