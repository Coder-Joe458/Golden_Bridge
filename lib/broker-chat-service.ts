import {
  BrokerConversationStatus,
  BrokerMessageSender,
  Prisma,
  UserRole
} from "@prisma/client";
import { prisma } from "./prisma";
import { maskBorrowerContact } from "./privacy";

const conversationInclude = {
  borrower: {
    select: {
      id: true,
      name: true,
      email: true,
      phoneNumber: true
    }
  },
  broker: {
    select: {
      id: true,
      name: true,
      email: true,
      phoneNumber: true,
      brokerProfile: {
        select: {
          id: true,
          company: true,
          headline: true
        }
      }
    }
  }
} satisfies Prisma.BrokerConversationInclude;

export async function ensureConversationForBorrower(borrowerId: string, brokerProfileId: string) {
  const profile = await prisma.brokerProfile.findUnique({
    where: { id: brokerProfileId },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          phoneNumber: true
        }
      }
    }
  });

  if (!profile || !profile.user) {
    throw new Error("Broker profile not found");
  }

  if (profile.user.id === borrowerId) {
    throw new Error("Cannot start a conversation with yourself");
  }

  const conversation = await prisma.brokerConversation.upsert({
    where: {
      borrowerId_brokerId: {
        borrowerId,
        brokerId: profile.user.id
      }
    },
    update: {
      status: BrokerConversationStatus.ACTIVE
    },
    create: {
      borrowerId,
      brokerId: profile.user.id
    },
    include: conversationInclude
  });

  const messages = await prisma.brokerMessage.findMany({
    where: { conversationId: conversation.id },
    orderBy: { createdAt: "asc" },
    take: 100
  });

  return { conversation, messages };
}

export async function listConversationsForUser(userId: string) {
  const role = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true }
  });

  const conversations = await prisma.brokerConversation.findMany({
    where: {
      OR: [{ borrowerId: userId }, { brokerId: userId }]
    },
    include: {
      ...conversationInclude,
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1
      }
    },
    orderBy: { lastMessageAt: "desc" }
  });

  return conversations.map((conversation) => {
    const lastMessage = conversation.messages[0] ?? null;
    const maskedBorrower =
      role?.role === UserRole.BROKER ? maskBorrowerContact(conversation.borrower) : conversation.borrower;
    return {
      id: conversation.id,
      status: conversation.status,
      borrower: maskedBorrower,
      broker: conversation.broker,
      lastMessage: lastMessage
        ? {
            id: lastMessage.id,
            senderType: lastMessage.senderType,
            content: lastMessage.content,
            createdAt: lastMessage.createdAt
          }
        : null,
      lastMessageAt: conversation.lastMessageAt,
      viewerRole: role?.role ?? UserRole.BORROWER
    };
  });
}

export async function getConversationWithMessages(conversationId: string, userId: string) {
  const conversation = await prisma.brokerConversation.findUnique({
    where: { id: conversationId },
    include: conversationInclude
  });

  if (!conversation) {
    throw new Error("Conversation not found");
  }

  if (conversation.borrowerId !== userId && conversation.brokerId !== userId) {
    throw new Error("Not authorized to view this conversation");
  }

  const messages = await prisma.brokerMessage.findMany({
    where: { conversationId },
    orderBy: { createdAt: "asc" },
    take: 200
  });

  const viewerRole = conversation.borrowerId === userId ? UserRole.BORROWER : UserRole.BROKER;

  return {
    conversation:
      viewerRole === UserRole.BROKER
        ? { ...conversation, borrower: maskBorrowerContact(conversation.borrower) }
        : conversation,
    messages,
    viewerRole
  };
}

export async function appendConversationMessage(conversationId: string, senderId: string, content: string) {
  if (!content.trim()) {
    throw new Error("Message content cannot be empty");
  }

  const conversation = await prisma.brokerConversation.findUnique({
    where: { id: conversationId }
  });

  if (!conversation) {
    throw new Error("Conversation not found");
  }

  let senderType: BrokerMessageSender | null = null;

  if (conversation.borrowerId === senderId) {
    senderType = BrokerMessageSender.BORROWER;
  } else if (conversation.brokerId === senderId) {
    senderType = BrokerMessageSender.BROKER;
  }

  if (!senderType) {
    throw new Error("Not authorized to send messages to this conversation");
  }

  const [message] = await prisma.$transaction([
    prisma.brokerMessage.create({
      data: {
        conversationId,
        senderId,
        senderType,
        content: content.trim()
      }
    }),
    prisma.brokerConversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: new Date() }
    })
  ]);

  return message;
}
