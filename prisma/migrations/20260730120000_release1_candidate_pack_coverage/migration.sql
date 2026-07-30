-- Release 1: Candidate Response Pack + Index Coverage Manifest
-- CV-XR-01a, CV-AX-06

CREATE TYPE "CandidatePackStatus" AS ENUM (
  'DRAFT_SCOPE',
  'SCOPE_CONFIRMED',
  'GENERATED',
  'APPROVED'
);

ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'CANDIDATE_PACK_SCOPE_CONFIRMED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'CANDIDATE_PACK_GENERATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'CANDIDATE_PACK_APPROVED';

CREATE TABLE "CandidateResponsePack" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "requestText" TEXT NOT NULL,
  "interpretedScope" JSONB NOT NULL,
  "confirmedScope" JSONB,
  "confirmedAt" TIMESTAMP(3),
  "confirmedByUserId" TEXT,
  "status" "CandidatePackStatus" NOT NULL DEFAULT 'DRAFT_SCOPE',
  "coverageStatement" JSONB,
  "retrievalBasis" TEXT,
  "meetingIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "emailEvidenceIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "auditChainRootId" TEXT,
  "exportManifestSha" TEXT,
  "approvedAt" TIMESTAMP(3),
  "approvedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "CandidateResponsePack_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CandidateResponsePack_workspaceId_status_idx" ON "CandidateResponsePack"("workspaceId", "status");
CREATE INDEX "CandidateResponsePack_workspaceId_createdAt_idx" ON "CandidateResponsePack"("workspaceId", "createdAt");

ALTER TABLE "CandidateResponsePack"
  ADD CONSTRAINT "CandidateResponsePack_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "IndexCoverageManifest" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "sources" JSONB NOT NULL,
  "gapPeriods" JSONB NOT NULL,
  "unindexedSources" JSONB NOT NULL,
  "lastIndexedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "IndexCoverageManifest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "IndexCoverageManifest_workspaceId_key" ON "IndexCoverageManifest"("workspaceId");
CREATE INDEX "IndexCoverageManifest_workspaceId_idx" ON "IndexCoverageManifest"("workspaceId");

ALTER TABLE "IndexCoverageManifest"
  ADD CONSTRAINT "IndexCoverageManifest_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
