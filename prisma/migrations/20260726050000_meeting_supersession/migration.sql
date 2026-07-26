-- CV-TR-16: supersession chain fields on Meeting + RECORD_SUPERSEDED audit action.

ALTER TABLE "Meeting"
  ADD COLUMN IF NOT EXISTS "supersedesId" TEXT,
  ADD COLUMN IF NOT EXISTS "supersededById" TEXT,
  ADD COLUMN IF NOT EXISTS "supersedeReason" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "Meeting_supersededById_key"
  ON "Meeting"("supersededById");

CREATE INDEX IF NOT EXISTS "Meeting_supersedesId_idx"
  ON "Meeting"("supersedesId");

DO $$
BEGIN
  ALTER TABLE "Meeting"
    ADD CONSTRAINT "Meeting_supersedesId_fkey"
    FOREIGN KEY ("supersedesId") REFERENCES "Meeting"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "Meeting"
    ADD CONSTRAINT "Meeting_supersededById_fkey"
    FOREIGN KEY ("supersededById") REFERENCES "Meeting"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'RECORD_SUPERSEDED';
