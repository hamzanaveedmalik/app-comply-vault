-- Additive: pgvector embeddings for hybrid Ask retrieval.
-- Safe on live data: CREATE EXTENSION is idempotent; new table only.
-- Requires Neon (or other host) with pgvector support.

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE "EvidenceEmbedding" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "sourceType" "EvidenceSourceType" NOT NULL,
    "sourceId" TEXT NOT NULL,
    "chunkKey" TEXT NOT NULL,
    "chunkTextHash" TEXT NOT NULL,
    "embedding" vector(1536) NOT NULL,
    "model" TEXT NOT NULL,
    "modelVersion" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "EvidenceEmbedding_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EvidenceEmbedding_workspaceId_chunkKey_model_key"
  ON "EvidenceEmbedding"("workspaceId", "chunkKey", "model");

CREATE INDEX "EvidenceEmbedding_workspaceId_sourceType_idx"
  ON "EvidenceEmbedding"("workspaceId", "sourceType");

CREATE INDEX "EvidenceEmbedding_workspaceId_sourceId_idx"
  ON "EvidenceEmbedding"("workspaceId", "sourceId");

ALTER TABLE "EvidenceEmbedding"
  ADD CONSTRAINT "EvidenceEmbedding_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
