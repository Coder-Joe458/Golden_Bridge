import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { appendConversationMessage, getConversationWithMessages } from "@/lib/broker-chat-service";

const sendMessageSchema = z.object({
  content: z.string().min(1, "Message content is required")
});

type RouteParams = {
  params: {
    conversationId: string;
  };
};

export async function GET(_request: Request, { params }: RouteParams) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const conversationId = params.conversationId;

  try {
    const { conversation, messages, viewerRole } = await getConversationWithMessages(conversationId, session.user.id);
    return NextResponse.json({ conversation, messages, viewerRole });
  } catch (error) {
    console.error("Failed to load broker conversation messages", error);
    return NextResponse.json({ error: "Failed to load messages" }, { status: 404 });
  }
}

export async function POST(request: Request, { params }: RouteParams) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const json = await request.json().catch(() => null);
  if (!json) {
    return NextResponse.json({ error: "Invalid request payload" }, { status: 400 });
  }

  const parsed = sendMessageSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Invalid request" }, { status: 400 });
  }

  const conversationId = params.conversationId;

  try {
    const message = await appendConversationMessage(conversationId, session.user.id, parsed.data.content);
    return NextResponse.json({ message });
  } catch (error) {
    console.error("Failed to send broker message", error);
    return NextResponse.json({ error: "Failed to send message" }, { status: 400 });
  }
}
