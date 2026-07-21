/**
 * Classification enqueue — Email Intelligence Phase 2.
 * Redacts via guard, then runs classify → flag pipeline when feature flag is on.
 */

import { db } from "~/server/db";
import { redactForLlm } from "./redaction-guard";
import { classifyEmailEvidence } from "./persist-email-classification";
import { isEmailIntelligenceEnabled } from "~/lib/feature-flags";

export type ClassificationEnqueuePayload = {
  workspaceId: string;
  evidenceItemId: string;
  redactedBody?: string;
};

const pendingClassification = new Set<string>();

export async function enqueueClassification(args: {
  workspaceId: string;
  evidenceItemId: string;
}): Promise<void> {
  const item = await db.evidenceItem.findFirst({
    where: {
      id: args.evidenceItemId,
      workspaceId: args.workspaceId,
      deletedAt: null,
    },
    include: { communication: true },
  });
  if (!item?.communication) return;

  const redacted = redactForLlm({
    bodyText: item.communication.bodyText,
    fromAddress: item.communication.fromAddress,
    toAddresses: item.communication.toAddresses,
  });

  pendingClassification.add(
    `${args.workspaceId}:${args.evidenceItemId}:${redacted.contentHash}`
  );

  if (!isEmailIntelligenceEnabled()) return;

  // Run inline with the same retry semantics as meeting extraction.
  // Failures are recorded as error status; ingest itself already succeeded.
  await classifyEmailEvidence({
    workspaceId: args.workspaceId,
    evidenceItemId: args.evidenceItemId,
  });
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
