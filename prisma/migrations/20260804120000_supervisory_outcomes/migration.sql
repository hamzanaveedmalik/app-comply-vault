-- CV-SI-001 / CV-SI-002 / CV-SI-003 — supervisory outcomes, sampling config, audit actions

CREATE TYPE "SupervisoryOutcome" AS ENUM (
  'CLEARED',
  'ROUTINE_SAMPLE',
  'ESCALATED',
  'HELD',
  'PARKED'
);

CREATE TYPE "SupervisoryHoldReason" AS ENUM (
  'ACTIVE_POLICY_UNAVAILABLE',
  'ORIGINAL_SOURCE_UNAVAILABLE',
  'ADVISER_UNRESOLVED',
  'REQUIRED_CLIENT_CONTEXT_UNRESOLVED',
  'PROCESSING_FAILED',
  'CONFIDENCE_BELOW_THRESHOLD',
  'MATERIAL_CONTEXT_CONTRADICTORY'
);

ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'SUPERVISORY_OUTCOME_ASSIGNED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'SUPERVISORY_SAMPLE_SELECTED';

ALTER TABLE "Meeting"
  ADD COLUMN IF NOT EXISTS "supervisoryOutcome" "SupervisoryOutcome",
  ADD COLUMN IF NOT EXISTS "outcomeReason" TEXT,
  ADD COLUMN IF NOT EXISTS "outcomeConfidence" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "processedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "primaryControlId" TEXT,
  ADD COLUMN IF NOT EXISTS "heldReason" "SupervisoryHoldReason",
  ADD COLUMN IF NOT EXISTS "parkedReason" TEXT;

CREATE INDEX IF NOT EXISTS "Meeting_workspaceId_supervisoryOutcome_idx"
  ON "Meeting"("workspaceId", "supervisoryOutcome");

ALTER TABLE "CommunicationThread"
  ADD COLUMN IF NOT EXISTS "supervisoryOutcome" "SupervisoryOutcome",
  ADD COLUMN IF NOT EXISTS "outcomeReason" TEXT,
  ADD COLUMN IF NOT EXISTS "outcomeConfidence" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "processedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "primaryControlId" TEXT,
  ADD COLUMN IF NOT EXISTS "heldReason" "SupervisoryHoldReason",
  ADD COLUMN IF NOT EXISTS "parkedReason" TEXT;

CREATE INDEX IF NOT EXISTS "CommunicationThread_workspaceId_supervisoryOutcome_idx"
  ON "CommunicationThread"("workspaceId", "supervisoryOutcome");

CREATE TABLE IF NOT EXISTS "SupervisorySamplingConfig" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "randomPercentage" INTEGER NOT NULL DEFAULT 3,
  "adviserRiskEnabled" BOOLEAN NOT NULL DEFAULT true,
  "adviserRiskOpenFlagFloor" INTEGER NOT NULL DEFAULT 2,
  "newAdviserEnabled" BOOLEAN NOT NULL DEFAULT true,
  "newAdviserWindowDays" INTEGER NOT NULL DEFAULT 30,
  "timeSinceLastReviewEnabled" BOOLEAN NOT NULL DEFAULT true,
  "reviewStalenessDays" INTEGER NOT NULL DEFAULT 30,
  "manualSelectionEnabled" BOOLEAN NOT NULL DEFAULT true,
  "controlSamplingPolicy" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "SupervisorySamplingConfig_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SupervisorySamplingConfig_workspaceId_key"
  ON "SupervisorySamplingConfig"("workspaceId");

CREATE INDEX IF NOT EXISTS "SupervisorySamplingConfig_workspaceId_idx"
  ON "SupervisorySamplingConfig"("workspaceId");

ALTER TABLE "SupervisorySamplingConfig"
  DROP CONSTRAINT IF EXISTS "SupervisorySamplingConfig_workspaceId_fkey";

ALTER TABLE "SupervisorySamplingConfig"
  ADD CONSTRAINT "SupervisorySamplingConfig_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
