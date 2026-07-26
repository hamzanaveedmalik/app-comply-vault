-- CV-TR-06a durable parked ingests + CV-TR-07 transcript hash / media discard
-- Additive only.

ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'INGEST_PARKED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'INGEST_REPLAYED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'MEDIA_DISCARDED';

CREATE TYPE "ParkedIngestStatus" AS ENUM ('PARKED', 'REPLAY_REQUESTED', 'INGESTED');

ALTER TABLE "Meeting"
  ADD COLUMN IF NOT EXISTS "transcriptSha256" TEXT,
  ADD COLUMN IF NOT EXISTS "mediaDiscardedAt" TIMESTAMP(3);

CREATE TABLE "ParkedIngest" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "externalRef" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "occurredAt" TIMESTAMP(3),
  "status" "ParkedIngestStatus" NOT NULL DEFAULT 'PARKED',
  "parkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "replayRequestedAt" TIMESTAMP(3),
  "replayRequestedById" TEXT,
  "meetingId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),

  CONSTRAINT "ParkedIngest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ParkedIngest_workspaceId_source_externalRef_key"
  ON "ParkedIngest"("workspaceId", "source", "externalRef");
CREATE INDEX "ParkedIngest_workspaceId_status_idx" ON "ParkedIngest"("workspaceId", "status");
CREATE INDEX "ParkedIngest_workspaceId_parkedAt_idx" ON "ParkedIngest"("workspaceId", "parkedAt");

ALTER TABLE "ParkedIngest"
  ADD CONSTRAINT "ParkedIngest_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
