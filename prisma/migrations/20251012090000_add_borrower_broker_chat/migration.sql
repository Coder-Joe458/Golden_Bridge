-- CreateEnum
CREATE TYPE "BrokerConversationStatus" AS ENUM ('ACTIVE', 'CLOSED');

-- CreateEnum
CREATE TYPE "BrokerMessageSender" AS ENUM ('BORROWER', 'BROKER', 'SYSTEM');

-- CreateTable
CREATE TABLE "BrokerConversation" (
    "id" TEXT NOT NULL,
    "borrowerId" TEXT NOT NULL,
    "brokerId" TEXT NOT NULL,
    "status" "BrokerConversationStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BrokerConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrokerMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "senderType" "BrokerMessageSender" NOT NULL,
    "content" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BrokerMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BrokerConversation_borrowerId_brokerId_key" ON "BrokerConversation"("borrowerId", "brokerId");

-- CreateIndex
CREATE INDEX "BrokerConversation_borrowerId_lastMessageAt_idx" ON "BrokerConversation"("borrowerId", "lastMessageAt" DESC);

-- CreateIndex
CREATE INDEX "BrokerConversation_brokerId_lastMessageAt_idx" ON "BrokerConversation"("brokerId", "lastMessageAt" DESC);

-- CreateIndex
CREATE INDEX "BrokerMessage_conversationId_createdAt_idx" ON "BrokerMessage"("conversationId", "createdAt");

-- AddForeignKey
ALTER TABLE "BrokerConversation" ADD CONSTRAINT "BrokerConversation_borrowerId_fkey" FOREIGN KEY ("borrowerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrokerConversation" ADD CONSTRAINT "BrokerConversation_brokerId_fkey" FOREIGN KEY ("brokerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrokerMessage" ADD CONSTRAINT "BrokerMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "BrokerConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrokerMessage" ADD CONSTRAINT "BrokerMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
