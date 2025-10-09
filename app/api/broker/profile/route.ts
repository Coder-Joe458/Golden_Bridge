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

  const profile = await prisma.brokerProfile.upsert({
    where: { userId: session.user.id },
    update: {
      company: data.company,
      headline: data.headline,
      bio: data.bio,
      licenseStates: data.licenseStates ?? [],
      yearsExperience: data.yearsExperience,
      website: data.website
    },
    create: {
      userId: session.user.id,
      company: data.company,
      headline: data.headline,
      bio: data.bio,
      licenseStates: data.licenseStates ?? [],
      yearsExperience: data.yearsExperience,
      website: data.website
    }
  });

  return NextResponse.json({ profile });
}
