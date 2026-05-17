-- Three-layer meeting sign-off: statuses, roles, CM triage, meeting sign-off fields, audit actions.

-- MeetingStatus
ALTER TYPE "MeetingStatus" ADD VALUE 'ADVISOR_CERTIFIED';
ALTER TYPE "MeetingStatus" ADD VALUE 'CM_REVIEWED';
ALTER TYPE "MeetingStatus" ADD VALUE 'CCO_SIGNED_OFF';

-- WorkspaceRole
ALTER TYPE "WorkspaceRole" ADD VALUE 'ADVISOR';

-- AuditAction
ALTER TYPE "AuditAction" ADD VALUE 'ADVISOR_CERTIFIED';
ALTER TYPE "AuditAction" ADD VALUE 'CM_REVIEW_COMPLETED';
ALTER TYPE "AuditAction" ADD VALUE 'CCO_SIGNED_OFF';
ALTER TYPE "AuditAction" ADD VALUE 'WORKFLOW_REVERTED';

-- CM flag triage disposition
CREATE TYPE "CmFlagDisposition" AS ENUM ('NONE', 'RESOLVED', 'NOTED', 'ESCALATED');

-- Meeting sign-off columns
ALTER TABLE "Meeting" ADD COLUMN "advisorCertifiedAt" TIMESTAMP(3);
ALTER TABLE "Meeting" ADD COLUMN "advisorCertifiedByUserId" TEXT;
ALTER TABLE "Meeting" ADD COLUMN "cmReviewedAt" TIMESTAMP(3);
ALTER TABLE "Meeting" ADD COLUMN "cmReviewedByUserId" TEXT;
ALTER TABLE "Meeting" ADD COLUMN "ccoSignedOffAt" TIMESTAMP(3);
ALTER TABLE "Meeting" ADD COLUMN "ccoSignedOffByUserId" TEXT;
ALTER TABLE "Meeting" ADD COLUMN "cmReviewSummary" JSONB;

-- Flag triage columns
ALTER TABLE "Flag" ADD COLUMN "cmDisposition" "CmFlagDisposition" NOT NULL DEFAULT 'NONE';
ALTER TABLE "Flag" ADD COLUMN "escalationReason" TEXT;
ALTER TABLE "Flag" ADD COLUMN "cmTriageNote" TEXT;
ALTER TABLE "Flag" ADD COLUMN "cmTriagedAt" TIMESTAMP(3);
ALTER TABLE "Flag" ADD COLUMN "cmTriagedByUserId" TEXT;

ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_advisorCertifiedByUserId_fkey" FOREIGN KEY ("advisorCertifiedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_cmReviewedByUserId_fkey" FOREIGN KEY ("cmReviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_ccoSignedOffByUserId_fkey" FOREIGN KEY ("ccoSignedOffByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Flag" ADD CONSTRAINT "Flag_cmTriagedByUserId_fkey" FOREIGN KEY ("cmTriagedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
