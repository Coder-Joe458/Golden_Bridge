import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { ensureConversationForBorrower, listConversationsForUser } from "@/lib/broker-chat-service";
import { UserRole } from "@prisma/client";

const createConversationSchema = z.object({
  brokerProfileId: z.string().min(1, "brokerProfileId is required")
});

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const conversations = await listConversationsForUser(session.user.id);
    return NextResponse.json({ conversations });
  } catch (error) {
    console.error("Failed to list broker conversations", error);
    return NextResponse.json({ error: "Failed to load conversations" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.user.role && session.user.role !== "BORROWER") {
    return NextResponse.json({ error: "Only borrowers can start conversations" }, { status: 403 });
  }

  const json = await request.json().catch(() => null);
  if (!json) {
    return NextResponse.json({ error: "Invalid request payload" }, { status: 400 });
  }

  const parsed = createConversationSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Invalid request" }, { status: 400 });
  }

  try {
    const result = await ensureConversationForBorrower(session.user.id, parsed.data.brokerProfileId);

    return NextResponse.json({
      conversation: result.conversation,
      messages: result.messages,
      viewerRole: UserRole.BORROWER
    });
  } catch (error) {
    console.error("Failed to start broker conversation", error);
    return NextResponse.json({ error: "Failed to start conversation" }, { status: 400 });
  }
}
