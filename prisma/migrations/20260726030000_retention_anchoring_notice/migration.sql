-- CV-TR-04a: one-time retention anchoring notice for migrated workspaces.

ALTER TABLE "Workspace"
  ADD COLUMN IF NOT EXISTS "retentionAnchoringNoticePending" BOOLEAN NOT NULL DEFAULT false;

-- Every workspace that already exists at deploy time went through (or predates)
-- fiscal-year anchoring and needs the one-time CCO notice. New workspaces
-- created after this migration keep the column default of false.
UPDATE "Workspace"
SET "retentionAnchoringNoticePending" = true;
