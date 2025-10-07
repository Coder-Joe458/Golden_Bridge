import { ChatMessageSender, ChatSession, ChatSessionStatus } from "@prisma/client";
import { prisma } from "./prisma";

export async function getOrCreateActiveSession(userId: string, sessionId?: string): Promise<ChatSession> {
  if (sessionId) {
    const existingById = await prisma.chatSession.findFirst({
      where: { id: sessionId, userId }
    });
    if (existingById) {
      if (existingById.status !== ChatSessionStatus.ACTIVE) {
        return prisma.chatSession.update({
          where: { id: existingById.id },
          data: { status: ChatSessionStatus.ACTIVE }
        });
      }
      return existingById;
    }
  }

  const existing = await prisma.chatSession.findFirst({
    where: { userId, status: ChatSessionStatus.ACTIVE },
    orderBy: { createdAt: "desc" }
  });

  if (existing) {
    return existing;
  }

  return prisma.chatSession.create({
    data: {
      userId,
      status: ChatSessionStatus.ACTIVE
    }
  });
}

export async function archiveSession(sessionId: string): Promise<void> {
  await prisma.chatSession.updateMany({
    where: { id: sessionId },
    data: { status: ChatSessionStatus.ARCHIVED }
  });
}

export async function appendMessage(
  sessionId: string,
  sender: ChatMessageSender,
  content: string,
  metadata?: Record<string, unknown>
) {
  return prisma.chatMessage.create({
    data: {
      sessionId,
      sender,
      content,
      metadata
    }
  });
}

export async function fetchRecentMessages(sessionId: string, take = 8) {
  const messages = await prisma.chatMessage.findMany({
    where: { sessionId },
    orderBy: { createdAt: "desc" },
    take
  });
  return messages.reverse();
}

export async function fetchActiveSessionWithMessages(userId: string) {
  let session = await prisma.chatSession.findFirst({
    where: { userId, status: ChatSessionStatus.ACTIVE },
    orderBy: { createdAt: "desc" },
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
        take: 50
      }
    }
  });

  if (!session) {
    session = await prisma.chatSession.create({
      data: {
        userId,
        status: ChatSessionStatus.ACTIVE
      },
      include: { messages: true }
    });
  }

  return session;
}

export async function resetSession(userId: string) {
  const activeSessions = await prisma.chatSession.findMany({
    where: { userId, status: ChatSessionStatus.ACTIVE }
  });

  if (activeSessions.length) {
    await prisma.chatSession.updateMany({
      where: { id: { in: activeSessions.map((s) => s.id) } },
      data: { status: ChatSessionStatus.ARCHIVED }
    });
  }

  return prisma.chatSession.create({
    data: {
      userId,
      status: ChatSessionStatus.ACTIVE
    }
  });
}

export async function updateSessionContext(sessionId: string, context: unknown) {
  await prisma.chatSession.update({
    where: { id: sessionId },
    data: { context }
  });
}
