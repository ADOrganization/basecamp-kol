-- Update KOLTier enum from old values to new values
-- Old: NANO, MICRO, MID, MACRO, MEGA
-- New: SMALL, MID, RISING, LARGE

-- First, add the new enum values
ALTER TYPE "KOLTier" ADD VALUE IF NOT EXISTS 'SMALL';
ALTER TYPE "KOLTier" ADD VALUE IF NOT EXISTS 'RISING';
ALTER TYPE "KOLTier" ADD VALUE IF NOT EXISTS 'LARGE';

-- Update existing records to use new tier values based on follower counts
-- NANO (<10k) -> SMALL
-- MICRO (10k-100k) -> will be split between MID, RISING based on actual followers
-- MID (100k-500k) -> RISING or LARGE based on actual followers
-- MACRO (500k-1M) -> LARGE
-- MEGA (1M+) -> LARGE

UPDATE "KOL" SET tier = 'SMALL' WHERE tier = 'NANO';
UPDATE "KOL" SET tier = 'LARGE' WHERE tier = 'MACRO';
UPDATE "KOL" SET tier = 'LARGE' WHERE tier = 'MEGA';

-- For MICRO tier, check follower counts
UPDATE "KOL" SET tier = 'MID' WHERE tier = 'MICRO' AND "followersCount" <= 20000;
UPDATE "KOL" SET tier = 'RISING' WHERE tier = 'MICRO' AND "followersCount" > 20000 AND "followersCount" < 75000;
UPDATE "KOL" SET tier = 'LARGE' WHERE tier = 'MICRO' AND "followersCount" >= 75000;

-- For old MID tier, check follower counts
UPDATE "KOL" SET tier = 'RISING' WHERE tier = 'MID' AND "followersCount" < 75000;
UPDATE "KOL" SET tier = 'LARGE' WHERE tier = 'MID' AND "followersCount" >= 75000;

-- Update default value
ALTER TABLE "KOL" ALTER COLUMN "tier" SET DEFAULT 'SMALL';
