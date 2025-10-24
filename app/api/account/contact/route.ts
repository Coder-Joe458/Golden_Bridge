import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ContactIdentifierError, parseContactIdentifier } from "@/lib/contact-identifiers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

const updateContactSchema = z
  .object({
    email: z.string().trim().optional(),
    phoneNumber: z.string().trim().optional()
  })
  .transform((data) => ({
    email: data.email === undefined ? undefined : data.email.length ? data.email : null,
    phoneNumber: data.phoneNumber === undefined ? undefined : data.phoneNumber.length ? data.phoneNumber : null
  }))
  .superRefine((data, ctx) => {
    if (data.email === undefined && data.phoneNumber === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "No changes provided"
      });
    }
  });

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { email: true, phoneNumber: true }
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({
    email: user.email,
    phoneNumber: user.phoneNumber
  });
}

export async function PUT(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch (error) {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const parsed = updateContactSchema.safeParse(payload);
  if (!parsed.success) {
    const message = parsed.error.issues.map((issue) => issue.message).join(" | ") || "Invalid request";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const currentUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { email: true, phoneNumber: true }
  });

  if (!currentUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const desiredEmail = parsed.data.email === undefined ? currentUser.email : parsed.data.email;
  const desiredPhoneRaw = parsed.data.phoneNumber === undefined ? currentUser.phoneNumber : parsed.data.phoneNumber;

  if (!desiredEmail && !desiredPhoneRaw) {
    return NextResponse.json(
      { error: "At least one contact method (email or phone number) must be provided." },
      { status: 400 }
    );
  }

  let normalizedEmail: string | null | undefined = desiredEmail;
  if (parsed.data.email !== undefined) {
    if (desiredEmail) {
      try {
        normalizedEmail = desiredEmail.toLowerCase();
      } catch (error) {
        return NextResponse.json({ error: "Invalid email address." }, { status: 400 });
      }
      const existingEmailUser = await prisma.user.findFirst({
        where: {
          email: normalizedEmail,
          NOT: { id: session.user.id }
        }
      });
      if (existingEmailUser) {
        return NextResponse.json({ error: "That email is already connected to another account." }, { status: 409 });
      }
    } else {
      normalizedEmail = null;
    }
  }

  let normalizedPhone: string | null | undefined = desiredPhoneRaw;
  if (parsed.data.phoneNumber !== undefined) {
    if (desiredPhoneRaw) {
      try {
        const contact = parseContactIdentifier(desiredPhoneRaw);
        if (contact.type !== "phone") {
          return NextResponse.json({ error: "Please provide a valid US phone number." }, { status: 400 });
        }
        normalizedPhone = contact.value;
      } catch (error) {
        const message =
          error instanceof ContactIdentifierError ? error.message : "Please provide a valid US phone number.";
        return NextResponse.json({ error: message }, { status: 400 });
      }

      const existingPhoneUser = await prisma.user.findFirst({
        where: {
          phoneNumber: normalizedPhone,
          NOT: { id: session.user.id }
        }
      });
      if (existingPhoneUser) {
        return NextResponse.json(
          { error: "That phone number is already connected to another account." },
          { status: 409 }
        );
      }
    } else {
      normalizedPhone = null;
    }
  }

  const updatedUser = await prisma.user.update({
    where: { id: session.user.id },
    data: {
      ...(normalizedEmail !== undefined ? { email: normalizedEmail } : {}),
      ...(normalizedPhone !== undefined ? { phoneNumber: normalizedPhone } : {})
    },
    select: {
      email: true,
      phoneNumber: true
    }
  });

  return NextResponse.json({
    email: updatedUser.email,
    phoneNumber: updatedUser.phoneNumber
  });
}
