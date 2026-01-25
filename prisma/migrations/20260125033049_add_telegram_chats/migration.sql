-- CreateEnum
CREATE TYPE "TelegramChatType" AS ENUM ('PRIVATE', 'GROUP', 'SUPERGROUP', 'CHANNEL');

-- CreateEnum
CREATE TYPE "TelegramChatStatus" AS ENUM ('ACTIVE', 'LEFT', 'KICKED');

-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "telegramWebhookSecret" TEXT;

-- CreateTable
CREATE TABLE "telegram_chats" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "telegramChatId" TEXT NOT NULL,
    "title" TEXT,
    "type" "TelegramChatType" NOT NULL DEFAULT 'GROUP',
    "username" TEXT,
    "status" "TelegramChatStatus" NOT NULL DEFAULT 'ACTIVE',
    "memberCount" INTEGER NOT NULL DEFAULT 0,
    "botJoinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "botLeftAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "telegram_chats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "telegram_chat_kols" (
    "id" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "kolId" TEXT NOT NULL,
    "telegramUserId" TEXT,
    "matchedBy" TEXT NOT NULL DEFAULT 'username',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "telegram_chat_kols_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "telegram_group_messages" (
    "id" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "telegramMessageId" TEXT,
    "content" TEXT NOT NULL,
    "direction" "MessageDirection" NOT NULL,
    "senderTelegramId" TEXT,
    "senderUsername" TEXT,
    "senderName" TEXT,
    "replyToMessageId" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "telegram_group_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "telegram_broadcasts" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "filterType" TEXT NOT NULL,
    "filterCampaignId" TEXT,
    "targetCount" INTEGER NOT NULL DEFAULT 0,
    "sentCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "telegram_broadcasts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "telegram_chats_organizationId_telegramChatId_key" ON "telegram_chats"("organizationId", "telegramChatId");

-- CreateIndex
CREATE UNIQUE INDEX "telegram_chat_kols_chatId_kolId_key" ON "telegram_chat_kols"("chatId", "kolId");

-- CreateIndex
CREATE INDEX "telegram_group_messages_chatId_timestamp_idx" ON "telegram_group_messages"("chatId", "timestamp");

-- AddForeignKey
ALTER TABLE "telegram_chats" ADD CONSTRAINT "telegram_chats_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "telegram_chat_kols" ADD CONSTRAINT "telegram_chat_kols_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "telegram_chats"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "telegram_chat_kols" ADD CONSTRAINT "telegram_chat_kols_kolId_fkey" FOREIGN KEY ("kolId") REFERENCES "kols"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "telegram_group_messages" ADD CONSTRAINT "telegram_group_messages_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "telegram_chats"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "telegram_broadcasts" ADD CONSTRAINT "telegram_broadcasts_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
