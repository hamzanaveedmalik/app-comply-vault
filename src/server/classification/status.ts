/**
 * EvidenceItem.classificationStatus helpers (shared by enqueue + persist).
 */

import { db } from "~/server/db";

export async function markClassificationFailed(args: {
  workspaceId: string;
  evidenceItemId: string;
}): Promise<void> {
  await db.evidenceItem.updateMany({
    where: {
      id: args.evidenceItemId,
      workspaceId: args.workspaceId,
      deletedAt: null,
    },
    data: { classificationStatus: "FAILED" },
  });
}

export async function markClassificationComplete(args: {
  workspaceId: string;
  evidenceItemId: string;
}): Promise<void> {
  await db.evidenceItem.updateMany({
    where: {
      id: args.evidenceItemId,
      workspaceId: args.workspaceId,
      deletedAt: null,
    },
    data: { classificationStatus: "COMPLETE" },
  });
}

export async function markClassificationPending(args: {
  workspaceId: string;
  evidenceItemId: string;
}): Promise<void> {
  await db.evidenceItem.updateMany({
    where: {
      id: args.evidenceItemId,
      workspaceId: args.workspaceId,
      deletedAt: null,
    },
    data: { classificationStatus: "PENDING" },
  });
}

export async function countFailedClassifications(
  workspaceId: string
): Promise<number> {
  return db.evidenceItem.count({
    where: {
      workspaceId,
      deletedAt: null,
      sourceType: "EMAIL",
      classificationStatus: "FAILED",
    },
  });
}
