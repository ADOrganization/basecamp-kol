-- AlterTable
ALTER TABLE "campaign_kols" ADD COLUMN     "requiredPosts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "requiredRetweets" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "requiredSpaces" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "requiredThreads" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "campaigns" ADD COLUMN     "keywords" TEXT[],
ADD COLUMN     "projectTwitterHandle" TEXT;

-- AlterTable
ALTER TABLE "posts" ADD COLUMN     "hasKeywordMatch" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "matchedKeywords" TEXT[];
