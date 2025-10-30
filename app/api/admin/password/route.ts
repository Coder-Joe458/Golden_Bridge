import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/auth-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

const schema = z.object({
  currentPassword: z.string().min(8, "Current password is required"),
  newPassword: z
    .string()
    .min(12, "Password must be at least 12 characters")
    .max(128, "Password is too long"),
  confirmPassword: z.string()
});

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

  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    const message = parsed.error.issues.map((issue) => issue.message).join(" | ");
    return NextResponse.json({ error: message || "Invalid payload" }, { status: 400 });
  }

  const { currentPassword, newPassword, confirmPassword } = parsed.data;

  if (newPassword !== confirmPassword) {
    return NextResponse.json({ error: "Passwords do not match" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { passwordHash: true }
  });

  if (!user?.passwordHash) {
    return NextResponse.json({ error: "Password reset is not available for this account" }, { status: 400 });
  }

  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) {
    return NextResponse.json({ error: "Current password is incorrect" }, { status: 401 });
  }

  const hashed = await bcrypt.hash(newPassword, 12);

  await prisma.user.update({
    where: { id: session.user.id },
    data: { passwordHash: hashed }
  });

  return NextResponse.json({ success: true });
}

