-- Compliance Cockpit — Firm Disclosure Profile (Epic 8.0)

-- CreateEnum
CREATE TYPE "DisclosureCategoryStatus" AS ENUM ('ACTIVE', 'SUPPRESSING', 'NEVER_SUPPRESS');
CREATE TYPE "FirmProfileStatus" AS ENUM ('DRAFT', 'ACTIVE');
CREATE TYPE "FirmProfileVersionType" AS ENUM ('INITIAL_SETUP', 'APPROVED');
CREATE TYPE "SuppressionAction" AS ENUM ('ACTIVATED', 'DEACTIVATED');

-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'DISCLOSURE_SUPPRESSION_ACTIVATED';
ALTER TYPE "AuditAction" ADD VALUE 'DISCLOSURE_SUPPRESSION_DEACTIVATED';
ALTER TYPE "AuditAction" ADD VALUE 'FIRM_PROFILE_APPROVED';

-- CreateTable
CREATE TABLE "FirmProfile" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "status" "FirmProfileStatus" NOT NULL DEFAULT 'DRAFT',
    "crdNumber" TEXT,
    "ccoName" TEXT,
    "advFilingDate" TIMESTAMP(3),
    "aumUsd" DECIMAL(65,30),
    "advDocumentUrl" TEXT,
    "advDocumentKey" TEXT,
    "riskFlags" TEXT[],
    "setupCompletedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "approvedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "FirmProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DisclosureCategory" (
    "id" TEXT NOT NULL,
    "firmProfileId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" "DisclosureCategoryStatus" NOT NULL DEFAULT 'ACTIVE',
    "suppressionEvidence" TEXT,
    "advItemRef" TEXT,
    "advPage" INTEGER,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DisclosureCategory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SuppressionLogEntry" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "firmProfileId" TEXT NOT NULL,
    "categorySlug" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "meetingId" TEXT,
    "action" "SuppressionAction" NOT NULL,
    "previousStatus" "DisclosureCategoryStatus",
    "newStatus" "DisclosureCategoryStatus" NOT NULL,
    "evidenceSnapshot" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SuppressionLogEntry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FirmProfileVersion" (
    "id" TEXT NOT NULL,
    "firmProfileId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "versionType" "FirmProfileVersionType" NOT NULL,
    "approvedByUserId" TEXT,
    "approvedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "snapshot" JSONB NOT NULL,

    CONSTRAINT "FirmProfileVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FirmProfile_workspaceId_key" ON "FirmProfile"("workspaceId");
CREATE INDEX "FirmProfile_workspaceId_idx" ON "FirmProfile"("workspaceId");
CREATE UNIQUE INDEX "DisclosureCategory_firmProfileId_slug_key" ON "DisclosureCategory"("firmProfileId", "slug");
CREATE INDEX "DisclosureCategory_firmProfileId_idx" ON "DisclosureCategory"("firmProfileId");
CREATE INDEX "SuppressionLogEntry_firmProfileId_createdAt_idx" ON "SuppressionLogEntry"("firmProfileId", "createdAt");
CREATE INDEX "SuppressionLogEntry_workspaceId_createdAt_idx" ON "SuppressionLogEntry"("workspaceId", "createdAt");
CREATE INDEX "FirmProfileVersion_firmProfileId_approvedAt_idx" ON "FirmProfileVersion"("firmProfileId", "approvedAt");
CREATE INDEX "FirmProfileVersion_workspaceId_idx" ON "FirmProfileVersion"("workspaceId");

-- AddForeignKey
ALTER TABLE "FirmProfile" ADD CONSTRAINT "FirmProfile_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DisclosureCategory" ADD CONSTRAINT "DisclosureCategory_firmProfileId_fkey" FOREIGN KEY ("firmProfileId") REFERENCES "FirmProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SuppressionLogEntry" ADD CONSTRAINT "SuppressionLogEntry_firmProfileId_fkey" FOREIGN KEY ("firmProfileId") REFERENCES "FirmProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FirmProfileVersion" ADD CONSTRAINT "FirmProfileVersion_firmProfileId_fkey" FOREIGN KEY ("firmProfileId") REFERENCES "FirmProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
