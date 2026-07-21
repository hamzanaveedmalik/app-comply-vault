-- CreateEnum
CREATE TYPE "FlagSourceType" AS ENUM ('MEETING', 'EMAIL');

-- CreateEnum
CREATE TYPE "EvidenceClassificationResult" AS ENUM ('CLEAN', 'FLAGGED');

-- AlterEnum FlagType
ALTER TYPE "FlagType" ADD VALUE 'GUARANTEED_RETURN';
ALTER TYPE "FlagType" ADD VALUE 'PERFORMANCE_CLAIM';
ALTER TYPE "FlagType" ADD VALUE 'CLIENT_COMPLAINT';
ALTER TYPE "FlagType" ADD VALUE 'UNAPPROVED_MARKETING';
ALTER TYPE "FlagType" ADD VALUE 'TRADE_INSTRUCTION';
ALTER TYPE "FlagType" ADD VALUE 'FEE_DISPUTE';
ALTER TYPE "FlagType" ADD VALUE 'OFF_CHANNEL_REFERENCE';
ALTER TYPE "FlagType" ADD VALUE 'SENSITIVE_PII_SHARE';
ALTER TYPE "FlagType" ADD VALUE 'GIFTS_ENTERTAINMENT';

-- AlterTable Flag: add polymorphic source columns
ALTER TABLE "Flag" ADD COLUMN "sourceType" "FlagSourceType" NOT NULL DEFAULT 'MEETING';
ALTER TABLE "Flag" ADD COLUMN "sourceId" TEXT;
ALTER TABLE "Flag" ADD COLUMN "communicationId" TEXT;
ALTER TABLE "Flag" ADD COLUMN "dedupeKey" TEXT;

-- Backfill existing flags as MEETING
UPDATE "Flag" SET "sourceId" = "meetingId" WHERE "sourceId" IS NULL;
ALTER TABLE "Flag" ALTER COLUMN "sourceId" SET NOT NULL;

-- Make meetingId nullable
ALTER TABLE "Flag" ALTER COLUMN "meetingId" DROP NOT NULL;

-- AlterTable ResolutionRecord
ALTER TABLE "ResolutionRecord" ALTER COLUMN "meetingId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "Flag_workspaceId_sourceType_sourceId_idx" ON "Flag"("workspaceId", "sourceType", "sourceId");
CREATE INDEX "Flag_communicationId_idx" ON "Flag"("communicationId");
CREATE UNIQUE INDEX "Flag_workspaceId_dedupeKey_key" ON "Flag"("workspaceId", "dedupeKey");

-- AddForeignKey
ALTER TABLE "Flag" ADD CONSTRAINT "Flag_communicationId_fkey" FOREIGN KEY ("communicationId") REFERENCES "Communication"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable EvidenceClassification
CREATE TABLE "EvidenceClassification" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "evidenceItemId" TEXT NOT NULL,
    "communicationId" TEXT,
    "contentHash" TEXT NOT NULL,
    "result" "EvidenceClassificationResult" NOT NULL,
    "modelId" TEXT,
    "promptVersion" TEXT,
    "signalCount" INTEGER NOT NULL DEFAULT 0,
    "rawResponse" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "EvidenceClassification_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EvidenceClassification_workspaceId_evidenceItemId_contentHash_key" ON "EvidenceClassification"("workspaceId", "evidenceItemId", "contentHash");
CREATE INDEX "EvidenceClassification_workspaceId_result_idx" ON "EvidenceClassification"("workspaceId", "result");
CREATE INDEX "EvidenceClassification_evidenceItemId_idx" ON "EvidenceClassification"("evidenceItemId");

ALTER TABLE "EvidenceClassification" ADD CONSTRAINT "EvidenceClassification_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
