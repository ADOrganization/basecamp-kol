-- Add hiddenFromReview column to posts (if not exists)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'posts' AND column_name = 'hiddenFromReview') THEN
        ALTER TABLE "posts" ADD COLUMN "hiddenFromReview" BOOLEAN NOT NULL DEFAULT false;
    END IF;
END $$;

-- Create PostMetricSnapshot table (if not exists)
CREATE TABLE IF NOT EXISTS "post_metric_snapshots" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "likes" INTEGER NOT NULL DEFAULT 0,
    "retweets" INTEGER NOT NULL DEFAULT 0,
    "replies" INTEGER NOT NULL DEFAULT 0,
    "quotes" INTEGER NOT NULL DEFAULT 0,
    "bookmarks" INTEGER NOT NULL DEFAULT 0,
    "engagementRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "post_metric_snapshots_pkey" PRIMARY KEY ("id")
);

-- Create KOLFollowerSnapshot table (if not exists)
CREATE TABLE IF NOT EXISTS "kol_follower_snapshots" (
    "id" TEXT NOT NULL,
    "kolId" TEXT NOT NULL,
    "followersCount" INTEGER NOT NULL DEFAULT 0,
    "followingCount" INTEGER NOT NULL DEFAULT 0,
    "followersChange" INTEGER NOT NULL DEFAULT 0,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kol_follower_snapshots_pkey" PRIMARY KEY ("id")
);

-- Create indexes (if not exists)
CREATE INDEX IF NOT EXISTS "post_metric_snapshots_postId_capturedAt_idx" ON "post_metric_snapshots"("postId", "capturedAt");
CREATE INDEX IF NOT EXISTS "kol_follower_snapshots_kolId_capturedAt_idx" ON "kol_follower_snapshots"("kolId", "capturedAt");

-- Add foreign keys (if not exists)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'post_metric_snapshots_postId_fkey') THEN
        ALTER TABLE "post_metric_snapshots" ADD CONSTRAINT "post_metric_snapshots_postId_fkey" FOREIGN KEY ("postId") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'kol_follower_snapshots_kolId_fkey') THEN
        ALTER TABLE "kol_follower_snapshots" ADD CONSTRAINT "kol_follower_snapshots_kolId_fkey" FOREIGN KEY ("kolId") REFERENCES "kols"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
