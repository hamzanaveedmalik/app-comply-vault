-- Additive: async email classification status on EvidenceItem.
-- Safe on live data: nullable column; existing EMAIL rows stay NULL until backfilled/reclassified.

CREATE TYPE "EvidenceClassificationStatus" AS ENUM ('PENDING', 'COMPLETE', 'FAILED');

ALTER TABLE "EvidenceItem" ADD COLUMN "classificationStatus" "EvidenceClassificationStatus";

CREATE INDEX "EvidenceItem_workspaceId_classificationStatus_idx"
  ON "EvidenceItem"("workspaceId", "classificationStatus");
