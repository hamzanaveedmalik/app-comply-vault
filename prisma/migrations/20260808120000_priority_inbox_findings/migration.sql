-- CV-SI-006 — CCO Priority Inbox finding fields and view audit

CREATE TYPE "FindingMateriality" AS ENUM ('HIGH', 'MEDIUM', 'LOW');

ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'FINDING_VIEWED';

ALTER TABLE "Flag"
  ADD COLUMN IF NOT EXISTS "escalatedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "assignedToUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "reviewDueAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "materiality" "FindingMateriality",
  ADD COLUMN IF NOT EXISTS "policyMappingCode" TEXT;

CREATE INDEX IF NOT EXISTS "Flag_workspaceId_assignedToUserId_idx"
  ON "Flag"("workspaceId", "assignedToUserId");

CREATE INDEX IF NOT EXISTS "Flag_workspaceId_escalatedAt_idx"
  ON "Flag"("workspaceId", "escalatedAt");

ALTER TABLE "Flag"
  ADD CONSTRAINT "Flag_assignedToUserId_fkey"
  FOREIGN KEY ("assignedToUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
