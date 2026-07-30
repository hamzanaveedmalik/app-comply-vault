/**
 * CV-FC-01 — Fail-closed refusal surface data.
 * Shows refusal, retention rule, parked record, and stored AuditEvent.
 */

import { db } from "~/server/db";

export type RefusalSurfaceDto = {
  parked: {
    id: string;
    source: string;
    externalRef: string;
    status: string;
    parkedAt: string;
    parkedFlag: true;
  };
  reason: string;
  retentionRuleProtected: string;
  auditEvent: {
    id: string;
    action: string;
    createdAt: string;
    userId: string;
    metadata: unknown;
  } | null;
  recoveryPath: string;
};

export async function getRefusalSurface(args: {
  workspaceId: string;
  parkedIngestId?: string;
}): Promise<RefusalSurfaceDto | null> {
  const parked = args.parkedIngestId
    ? await db.parkedIngest.findFirst({
        where: {
          id: args.parkedIngestId,
          workspaceId: args.workspaceId,
          deletedAt: null,
        },
      })
    : await db.parkedIngest.findFirst({
        where: {
          workspaceId: args.workspaceId,
          deletedAt: null,
          status: { in: ["PARKED", "REPLAY_REQUESTED"] },
        },
        orderBy: { parkedAt: "desc" },
      });

  if (!parked) return null;

  const workspace = await db.workspace.findFirst({
    where: { id: args.workspaceId },
    select: { retentionYears: true, mediaPosture: true },
  });

  const auditEvent = await db.auditEvent.findFirst({
    where: {
      workspaceId: args.workspaceId,
      action: "INGEST_PARKED",
      metadata: {
        path: ["externalRef"],
        equals: parked.externalRef,
      },
    },
    orderBy: { timestamp: "desc" },
  });

  // Fallback: latest INGEST_PARKED for workspace if metadata path query unsupported
  const audit =
    auditEvent ??
    (await db.auditEvent.findFirst({
      where: {
        workspaceId: args.workspaceId,
        action: "INGEST_PARKED",
      },
      orderBy: { timestamp: "desc" },
    }));

  return {
    parked: {
      id: parked.id,
      source: parked.source,
      externalRef: parked.externalRef,
      status: parked.status,
      parkedAt: parked.parkedAt.toISOString(),
      parkedFlag: true,
    },
    reason:
      "Ingest refused because no media posture decision exists (fail-closed).",
    retentionRuleProtected: `Rule 204-2 retention (${workspace?.retentionYears ?? 5} years from fiscal year end). Source media posture must be decided before processing.`,
    auditEvent: audit
      ? {
          id: audit.id,
          action: audit.action,
          createdAt: audit.timestamp.toISOString(),
          userId: audit.userId,
          metadata: audit.metadata,
        }
      : null,
    recoveryPath: `/settings/media-posture`,
  };
}
