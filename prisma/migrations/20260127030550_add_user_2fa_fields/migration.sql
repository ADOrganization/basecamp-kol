-- CreateEnum
CREATE TYPE "AdminRole" AS ENUM ('SUPER_ADMIN', 'USER', 'ADMIN', 'VIEWER');

-- CreateEnum
CREATE TYPE "CampaignVisibility" AS ENUM ('PRIVATE', 'OPEN');

-- CreateEnum
CREATE TYPE "JoinRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'DECLINED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "CryptoNetwork" AS ENUM ('ETHEREUM', 'POLYGON', 'ARBITRUM', 'OPTIMISM', 'BASE', 'BSC', 'SOLANA');

-- AlterEnum
ALTER TYPE "PostStatus" ADD VALUE 'CHANGES_REQUESTED';

-- AlterTable
ALTER TABLE "campaigns" ADD COLUMN     "applicationDeadline" TIMESTAMP(3),
ADD COLUMN     "maxKolCount" INTEGER,
ADD COLUMN     "projectAvatarUrl" TEXT,
ADD COLUMN     "projectBannerUrl" TEXT,
ADD COLUMN     "visibility" "CampaignVisibility" NOT NULL DEFAULT 'PRIVATE';

-- AlterTable
ALTER TABLE "kols" ADD COLUMN     "bio" TEXT,
ADD COLUMN     "categories" TEXT[],
ADD COLUMN     "telegramGroupId" TEXT,
ALTER COLUMN "tier" SET DEFAULT 'SMALL';

-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "socialDataApiKey" TEXT;

-- AlterTable
ALTER TABLE "telegram_broadcasts" ADD COLUMN     "targetType" TEXT NOT NULL DEFAULT 'groups';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "backupCodes" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "emailVerified" TIMESTAMP(3),
ADD COLUMN     "isDisabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lastLoginAt" TIMESTAMP(3),
ADD COLUMN     "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "twoFactorSecret" TEXT,
ALTER COLUMN "passwordHash" DROP NOT NULL;

-- CreateTable
CREATE TABLE "admin_users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT,
    "avatarUrl" TEXT,
    "twitterUsername" TEXT,
    "role" "AdminRole" NOT NULL DEFAULT 'USER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
    "twoFactorSecret" TEXT,
    "backupCodes" TEXT[],
    "invitedBy" TEXT,
    "invitedAt" TIMESTAMP(3),

    CONSTRAINT "admin_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_receipts" (
    "id" TEXT NOT NULL,
    "kolId" TEXT NOT NULL,
    "campaignId" TEXT,
    "amount" INTEGER NOT NULL DEFAULT 0,
    "proofUrl" TEXT NOT NULL,
    "telegramUsername" TEXT,
    "telegramUserId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaign_join_requests" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "kolId" TEXT NOT NULL,
    "status" "JoinRequestStatus" NOT NULL DEFAULT 'PENDING',
    "message" TEXT,
    "responseNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "respondedAt" TIMESTAMP(3),

    CONSTRAINT "campaign_join_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_tokens" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verification_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_invitations" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "role" "OrganizationRole" NOT NULL DEFAULT 'MEMBER',
    "invitedBy" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "security_audit_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "security_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "admin_users_email_key" ON "admin_users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "payment_receipts_proofUrl_key" ON "payment_receipts"("proofUrl");

-- CreateIndex
CREATE UNIQUE INDEX "campaign_join_requests_campaignId_kolId_key" ON "campaign_join_requests"("campaignId", "kolId");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_token_key" ON "verification_tokens"("token");

-- CreateIndex
CREATE INDEX "verification_tokens_expires_idx" ON "verification_tokens"("expires");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_identifier_token_key" ON "verification_tokens"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "user_invitations_token_key" ON "user_invitations"("token");

-- CreateIndex
CREATE INDEX "user_invitations_email_idx" ON "user_invitations"("email");

-- CreateIndex
CREATE INDEX "user_invitations_organizationId_idx" ON "user_invitations"("organizationId");

-- CreateIndex
CREATE INDEX "security_audit_logs_userId_createdAt_idx" ON "security_audit_logs"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "security_audit_logs_action_createdAt_idx" ON "security_audit_logs"("action", "createdAt");

-- CreateIndex
CREATE INDEX "security_audit_logs_ipAddress_createdAt_idx" ON "security_audit_logs"("ipAddress", "createdAt");

-- AddForeignKey
ALTER TABLE "payment_receipts" ADD CONSTRAINT "payment_receipts_kolId_fkey" FOREIGN KEY ("kolId") REFERENCES "kols"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_receipts" ADD CONSTRAINT "payment_receipts_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_join_requests" ADD CONSTRAINT "campaign_join_requests_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_join_requests" ADD CONSTRAINT "campaign_join_requests_kolId_fkey" FOREIGN KEY ("kolId") REFERENCES "kols"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_invitations" ADD CONSTRAINT "user_invitations_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_invitations" ADD CONSTRAINT "user_invitations_invitedBy_fkey" FOREIGN KEY ("invitedBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "security_audit_logs" ADD CONSTRAINT "security_audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
