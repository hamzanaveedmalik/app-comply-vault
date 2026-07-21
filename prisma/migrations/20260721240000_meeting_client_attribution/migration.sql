-- Additive: Meeting → Client FK + attribution confidence + participant emails.
-- Safe on live data: new nullable columns only; no backfill in SQL (app job handles it).

CREATE TYPE "MeetingClientMatchConfidence" AS ENUM ('EMAIL', 'NAME_EXACT', 'MANUAL');

ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'MEETING_CLIENT_ATTRIBUTED';

ALTER TABLE "Meeting" ADD COLUMN "clientId" TEXT;
ALTER TABLE "Meeting" ADD COLUMN "clientMatchConfidence" "MeetingClientMatchConfidence";
ALTER TABLE "Meeting" ADD COLUMN "participantEmails" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

CREATE INDEX "Meeting_workspaceId_clientId_idx" ON "Meeting"("workspaceId", "clientId");
CREATE INDEX "Meeting_workspaceId_clientMatchConfidence_idx" ON "Meeting"("workspaceId", "clientMatchConfidence");

ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
