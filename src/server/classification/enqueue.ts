/**
 * Classification enqueue — Email Intelligence Phase 2/hardening.
 * Publishes a QStash job (ids only). Never puts email body in the queue payload.
 * Falls back to fire-and-forget local classify when QStash is unavailable.
 */

import { db } from "~/server/db";
import { redactForLlm } from "./redaction-guard";
import { classifyEmailEvidence } from "./persist-email-classification";
import { isEmailIntelligenceEnabled } from "~/lib/feature-flags";
import { publishEmailClassificationJob } from "~/server/qstash";
import {
  countFailedClassifications,
  markClassificationFailed,
  markClassificationPending,
} from "./status";

export type ClassificationEnqueuePayload = {
  workspaceId: string;
  evidenceItemId: string;
};

export {
  countFailedClassifications,
  markClassificationComplete,
  markClassificationFailed,
  markClassificationPending,
} from "./status";

const pendingClassification = new Set<string>();

/**
 * Enqueue classification for an evidence item. Safe to call from ingest:
 * never throws for queue/LLM failures (ingest must not fail on classify).
 */
export async function enqueueClassification(args: {
  workspaceId: string;
  evidenceItemId: string;
}): Promise<void> {
  try {
    if (!isEmailIntelligenceEnabled()) return;

    const item = await db.evidenceItem.findFirst({
      where: {
        id: args.evidenceItemId,
        workspaceId: args.workspaceId,
        deletedAt: null,
      },
      include: { communication: true },
    });
    if (!item?.communication) return;

    // Redaction guard must run before any enqueue (testable choke-point).
    const redacted = redactForLlm({
      bodyText: item.communication.bodyText,
      fromAddress: item.communication.fromAddress,
      toAddresses: item.communication.toAddresses,
    });

    pendingClassification.add(
      `${args.workspaceId}:${args.evidenceItemId}:${redacted.contentHash}`
    );

    await markClassificationPending({
      workspaceId: args.workspaceId,
      evidenceItemId: item.id,
    });

    const messageId = await publishEmailClassificationJob({
      workspaceId: args.workspaceId,
      evidenceItemId: args.evidenceItemId,
    });

    if (!messageId) {
      // Local / no QStash: run async so ingest is not blocked by LLM latency.
      void classifyEmailEvidence({
        workspaceId: args.workspaceId,
        evidenceItemId: args.evidenceItemId,
      }).then(async (result) => {
        if (result.status === "error") {
          await markClassificationFailed({
            workspaceId: args.workspaceId,
            evidenceItemId: args.evidenceItemId,
          });
        }
      });
    }
  } catch (err) {
    console.error("enqueueClassification failed (ingest continues)", {
      evidenceItemId: args.evidenceItemId,
      reason: err instanceof Error ? err.message : "unknown",
    });
  }
}

/**
 * Re-queue a failed (or forced) classification. Does not put content in the payload.
 */
export async function reclassifyEvidence(args: {
  workspaceId: string;
  evidenceItemId: string;
}): Promise<{ success: true } | { success: false; error: string }> {
  if (!isEmailIntelligenceEnabled()) {
    return { success: false, error: "Feature disabled" };
  }

  const item = await db.evidenceItem.findFirst({
    where: {
      id: args.evidenceItemId,
      workspaceId: args.workspaceId,
      deletedAt: null,
      sourceType: "EMAIL",
    },
    select: { id: true, classificationStatus: true },
  });
  if (!item) {
    return { success: false, error: "Evidence not found" };
  }

  await markClassificationPending({
    workspaceId: args.workspaceId,
    evidenceItemId: item.id,
  });

  await enqueueClassification({
    workspaceId: args.workspaceId,
    evidenceItemId: item.id,
  });

  return { success: true };
}

/** Test-only: verify redaction ran before enqueue */
export function wasClassificationEnqueued(
  workspaceId: string,
  evidenceItemId: string
): boolean {
  return [...pendingClassification].some((k) =>
    k.startsWith(`${workspaceId}:${evidenceItemId}:`)
  );
}

export function clearClassificationQueueForTests(): void {
  pendingClassification.clear();
}
