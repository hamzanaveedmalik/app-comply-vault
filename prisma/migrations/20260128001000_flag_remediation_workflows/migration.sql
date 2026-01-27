-- Add new AuditAction values
ALTER TYPE "AuditAction" ADD VALUE 'REMEDIATION_START';
ALTER TYPE "AuditAction" ADD VALUE 'REMEDIATION_UPDATE';
ALTER TYPE "AuditAction" ADD VALUE 'TASK_UPDATE';
ALTER TYPE "AuditAction" ADD VALUE 'EVIDENCE_ADD';
ALTER TYPE "AuditAction" ADD VALUE 'VERIFICATION';
ALTER TYPE "AuditAction" ADD VALUE 'OVERRIDE';

-- CreateEnum
CREATE TYPE "RemediationTaskStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "EvidenceType" AS ENUM ('TRANSCRIPT_SNIPPET', 'DOCUMENT_LINK', 'OUTREACH_PROOF', 'ACKNOWLEDGEMENT', 'NOTE');

-- CreateEnum
CREATE TYPE "VerificationDecision" AS ENUM ('APPROVED', 'REJECTED');

-- Update FlagStatus enum
CREATE TYPE "FlagStatus_new" AS ENUM ('OPEN', 'IN_REMEDIATION', 'PENDING_VERIFICATION', 'CLOSED', 'CLOSED_ACCEPTED_RISK');

ALTER TABLE "Flag" ALTER COLUMN "status" DROP DEFAULT;

ALTER TABLE "Flag" ALTER COLUMN "status" TYPE "FlagStatus_new" USING (
  CASE "status"
    WHEN 'OPEN' THEN 'OPEN'
    WHEN 'RESOLVED' THEN 'CLOSED'
    WHEN 'DISMISSED' THEN 'CLOSED'
    WHEN 'OVERRIDDEN' THEN 'CLOSED_ACCEPTED_RISK'
  END
)::"FlagStatus_new";

ALTER TABLE "Flag" ALTER COLUMN "status" SET DEFAULT 'OPEN';

DROP TYPE "FlagStatus";
ALTER TYPE "FlagStatus_new" RENAME TO "FlagStatus";

-- CreateTable
CREATE TABLE "ResolutionRecord" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "flagId" TEXT NOT NULL,
    "resolutionType" "FlagResolutionType" NOT NULL,
    "rationale" TEXT NOT NULL,
    "metadata" JSONB,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "submittedForVerificationAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "closedByUserId" TEXT,
    "overrideReason" TEXT,
    "overrideCategory" TEXT,

    CONSTRAINT "ResolutionRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActionItem" (
    "id" TEXT NOT NULL,
    "resolutionId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "RemediationTaskStatus" NOT NULL DEFAULT 'OPEN',
    "ownerId" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "completionNote" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActionItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvidenceLink" (
    "id" TEXT NOT NULL,
    "resolutionId" TEXT NOT NULL,
    "taskId" TEXT,
    "type" "EvidenceType" NOT NULL,
    "label" TEXT,
    "url" TEXT,
    "metadata" JSONB,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvidenceLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Verification" (
    "id" TEXT NOT NULL,
    "resolutionId" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "decision" "VerificationDecision" NOT NULL,
    "note" TEXT,
    "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Verification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ResolutionRecord_flagId_key" ON "ResolutionRecord"("flagId");

-- CreateIndex
CREATE INDEX "ResolutionRecord_workspaceId_idx" ON "ResolutionRecord"("workspaceId");

-- CreateIndex
CREATE INDEX "ResolutionRecord_meetingId_idx" ON "ResolutionRecord"("meetingId");

-- CreateIndex
CREATE INDEX "ActionItem_resolutionId_idx" ON "ActionItem"("resolutionId");

-- CreateIndex
CREATE INDEX "ActionItem_ownerId_idx" ON "ActionItem"("ownerId");

-- CreateIndex
CREATE INDEX "ActionItem_dueDate_idx" ON "ActionItem"("dueDate");

-- CreateIndex
CREATE INDEX "EvidenceLink_resolutionId_idx" ON "EvidenceLink"("resolutionId");

-- CreateIndex
CREATE INDEX "EvidenceLink_taskId_idx" ON "EvidenceLink"("taskId");

-- CreateIndex
CREATE INDEX "Verification_resolutionId_idx" ON "Verification"("resolutionId");

-- CreateIndex
CREATE INDEX "Verification_reviewerId_idx" ON "Verification"("reviewerId");

-- AddForeignKey
ALTER TABLE "ResolutionRecord" ADD CONSTRAINT "ResolutionRecord_flagId_fkey" FOREIGN KEY ("flagId") REFERENCES "Flag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResolutionRecord" ADD CONSTRAINT "ResolutionRecord_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResolutionRecord" ADD CONSTRAINT "ResolutionRecord_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionItem" ADD CONSTRAINT "ActionItem_resolutionId_fkey" FOREIGN KEY ("resolutionId") REFERENCES "ResolutionRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceLink" ADD CONSTRAINT "EvidenceLink_resolutionId_fkey" FOREIGN KEY ("resolutionId") REFERENCES "ResolutionRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceLink" ADD CONSTRAINT "EvidenceLink_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "ActionItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Verification" ADD CONSTRAINT "Verification_resolutionId_fkey" FOREIGN KEY ("resolutionId") REFERENCES "ResolutionRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;
