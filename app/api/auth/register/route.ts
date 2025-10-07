import { hash } from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

const registerSchema = z.object({
  name: z.string().min(2).max(80),
  email: z.string().email(),
  password: z.string().min(8).max(72),
  role: z.enum(["BORROWER", "BROKER"])
});

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  if (!json) {
    return NextResponse.json({ error: "Invalid request payload" }, { status: 400 });
  }

  const parsed = registerSchema.safeParse(json);
  if (!parsed.success) {
    const flattened = parsed.error.flatten();
    const fieldMessages = Object.entries(flattened.fieldErrors).flatMap(([field, errors]) =>
      (errors ?? []).map((message) => `${field}: ${message}`)
    );
    const combined = [...flattened.formErrors, ...fieldMessages]
      .map((message) => message.trim())
      .filter(Boolean);

    return NextResponse.json(
      { error: combined.join(" | ") || "Invalid registration data." },
      { status: 400 }
    );
  }

  const { name, email, password, role } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "An account with that email already exists." }, { status: 409 });
  }

  const passwordHash = await hash(password, 10);

  try {
    await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        role
      }
    });
  } catch (error) {
    console.error("Register API error", error);
    return NextResponse.json({ error: "Unable to create account. Please try again." }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
