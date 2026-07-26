-- CV-TR-04 / CV-TR-04a / CV-TR-06 schema foundation
-- Additive: fiscal-year retention fields, media posture (nullable), audit actions.
-- Existing workspaces: retentionYears raised to at least 6 so effective retention is never shortened.

CREATE TYPE "MediaPosture" AS ENUM ('RETAIN', 'DISCARD');

ALTER TABLE "Workspace"
  ADD COLUMN IF NOT EXISTS "fiscalYearEndMonth" INTEGER NOT NULL DEFAULT 12,
  ADD COLUMN IF NOT EXISTS "fiscalTimezone" TEXT NOT NULL DEFAULT 'America/New_York',
  ADD COLUMN IF NOT EXISTS "mediaPosture" "MediaPosture",
  ADD COLUMN IF NOT EXISTS "postureSetById" TEXT,
  ADD COLUMN IF NOT EXISTS "postureSetAt" TIMESTAMP(3);

-- CV-TR-04a: never shorten live workspaces (previous default was 6 from record date)
UPDATE "Workspace"
SET "retentionYears" = GREATEST("retentionYears", 6);

-- New-workspace Prisma default is 5; column default for raw inserts follows new policy
ALTER TABLE "Workspace" ALTER COLUMN "retentionYears" SET DEFAULT 5;

ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'RETENTION_POLICY_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'MEDIA_POSTURE_SET';
