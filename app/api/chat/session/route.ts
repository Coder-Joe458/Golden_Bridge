import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { fetchActiveSessionWithMessages, resetSession } from "@/lib/chat-service";
import { ChatMessageSender } from "@prisma/client";

function mapSender(sender: ChatMessageSender): "ai" | "user" | "system" {
  switch (sender) {
    case ChatMessageSender.AI:
      return "ai";
    case ChatMessageSender.USER:
      return "user";
    default:
      return "system";
  }
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const chatSession = await fetchActiveSessionWithMessages(session.user.id);

  return NextResponse.json({
    sessionId: chatSession.id,
    summary: chatSession.context ?? null,
    messages: chatSession.messages.map((message) => ({
      id: message.id,
      author: mapSender(message.sender),
      content: message.content
    }))
  });
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body || body.action !== "reset") {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const chatSession = await resetSession(session.user.id);

  return NextResponse.json({
    sessionId: chatSession.id,
    summary: chatSession.context ?? null,
    messages: []
  });
}
