/**
 * Client correspondence activity writes and aggregates.
 */

import type { CommunicationDirection, Prisma } from "../../../generated/prisma";
import { db } from "~/server/db";
import { isEmailIntelligenceEnabled } from "~/lib/feature-flags";

export type RecordEmailActivityArgs = {
  workspaceId: string;
  clientId: string;
  direction: CommunicationDirection;
  occurredAt: Date;
  title: string | null;
  counterparties: string[];
  evidenceItemId: string;
  threadId: string;
  contentSha256: string;
  /** When true, type is TRIAGE_ATTACHED instead of direction-based. */
  fromTriage?: boolean;
};

function activityTypeForDirection(
  direction: CommunicationDirection,
  fromTriage: boolean
): "EMAIL_RECEIVED" | "EMAIL_SENT" | "EMAIL_INTERNAL" | "TRIAGE_ATTACHED" {
  if (fromTriage) return "TRIAGE_ATTACHED";
  if (direction === "OUTBOUND") return "EMAIL_SENT";
  if (direction === "INTERNAL") return "EMAIL_INTERNAL";
  return "EMAIL_RECEIVED";
}

/**
 * Idempotent correspondence event + lastContactAt bump. No-op when feature flag is off.
 */
export async function recordEmailCorrespondenceActivity(
  args: RecordEmailActivityArgs,
  tx: Prisma.TransactionClient | typeof db = db
): Promise<boolean> {
  if (!isEmailIntelligenceEnabled()) return false;

  const type = activityTypeForDirection(args.direction, args.fromTriage === true);

  await tx.clientActivity.upsert({
    where: {
      workspaceId_evidenceItemId_clientId: {
        workspaceId: args.workspaceId,
        evidenceItemId: args.evidenceItemId,
        clientId: args.clientId,
      },
    },
    create: {
      workspaceId: args.workspaceId,
      clientId: args.clientId,
      type,
      occurredAt: args.occurredAt,
      title: args.title,
      direction: args.direction,
      counterparties: args.counterparties,
      evidenceItemId: args.evidenceItemId,
      threadId: args.threadId,
      contentSha256: args.contentSha256,
    },
    update: {
      title: args.title,
      direction: args.direction,
      counterparties: args.counterparties,
      contentSha256: args.contentSha256,
      deletedAt: null,
    },
  });

  const client = await tx.client.findFirst({
    where: {
      id: args.clientId,
      workspaceId: args.workspaceId,
      deletedAt: null,
    },
    select: { lastContactAt: true },
  });
  if (!client) return true;

  if (!client.lastContactAt || args.occurredAt > client.lastContactAt) {
    await tx.client.update({
      where: { id: args.clientId },
      data: { lastContactAt: args.occurredAt },
    });
  }

  return true;
}

/**
 * Correspondence count for a client (and optional household peers) in [from, to].
 */
export async function countCorrespondenceInPeriod(args: {
  workspaceId: string;
  clientIds: string[];
  from: Date;
  to: Date;
}): Promise<number> {
  if (args.clientIds.length === 0) return 0;
  return db.clientActivity.count({
    where: {
      workspaceId: args.workspaceId,
      clientId: { in: args.clientIds },
      deletedAt: null,
      occurredAt: { gte: args.from, lte: args.to },
      type: {
        in: ["EMAIL_RECEIVED", "EMAIL_SENT", "EMAIL_INTERNAL", "TRIAGE_ATTACHED"],
      },
    },
  });
}
