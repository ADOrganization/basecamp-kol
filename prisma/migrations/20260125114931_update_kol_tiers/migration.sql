-- Update KOLTier enum from old values to new values
-- Old: NANO, MICRO, MID, MACRO, MEGA
-- New: SMALL, MID, RISING, LARGE

-- Add new enum values (IF NOT EXISTS handles if they already exist)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'SMALL' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'KOLTier')) THEN
        ALTER TYPE "KOLTier" ADD VALUE 'SMALL';
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'RISING' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'KOLTier')) THEN
        ALTER TYPE "KOLTier" ADD VALUE 'RISING';
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'LARGE' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'KOLTier')) THEN
        ALTER TYPE "KOLTier" ADD VALUE 'LARGE';
    END IF;
END $$;
