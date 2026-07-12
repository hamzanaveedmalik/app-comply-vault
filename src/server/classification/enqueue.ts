/**
 * Classification enqueue stub — consumed by Epic C.
 * Epic B CV-B-03 (queue hook) + CV-B-09 redaction guard.
 */

import { db } from "~/server/db";
import { redactForLlm } from "./redaction-guard";

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
