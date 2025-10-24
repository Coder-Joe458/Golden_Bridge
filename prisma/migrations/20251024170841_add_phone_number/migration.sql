/*
  Warnings:

  - A unique constraint covering the columns `[phoneNumber]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "BrokerConversation_borrowerId_lastMessageAt_idx";

-- DropIndex
DROP INDEX "BrokerConversation_brokerId_lastMessageAt_idx";

-- AlterTable
ALTER TABLE "BrokerConversation" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "phoneNumber" TEXT,
ALTER COLUMN "email" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "BrokerConversation_borrowerId_lastMessageAt_idx" ON "BrokerConversation"("borrowerId", "lastMessageAt");

-- CreateIndex
CREATE INDEX "BrokerConversation_brokerId_lastMessageAt_idx" ON "BrokerConversation"("brokerId", "lastMessageAt");

-- CreateIndex
CREATE UNIQUE INDEX "User_phoneNumber_key" ON "User"("phoneNumber");
