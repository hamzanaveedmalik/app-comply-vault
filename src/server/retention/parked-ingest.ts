/**
 * CV-TR-06a — durable parked ingests.
 *
 * A parked ingest is a work item, not a log line: it holds enough of the original
 * job payload to replay once the CCO records a posture decision. These rows are
 * proto coverage gaps and should feed the CV-COV-06 coverage queue when it lands,
 * not become a second parallel list.
 */

import type { Prisma } from "../../../generated/prisma";
import { db } from "~/server/db";

export type ParkedIngestSource = "zoom" | "teams";

/**
 * Persist a parked ingest and its audit event. Upsert on the source ref so
 * webhook retries do not create duplicates; the newest payload wins (fresher
 * download tokens).
 */
export async function parkIngest(args: {
  workspaceId: string;
  source: ParkedIngestSource;
  externalRef: string;
  payload: Prisma.InputJsonValue;
  occurredAt?: Date | null;
}): Promise<void> {
  await db.$transaction(async (tx) => {
    await tx.parkedIngest.upsert({
      where: {
        workspaceId_source_externalRef: {
          workspaceId: args.workspaceId,
          source: args.source,
          externalRef: args.externalRef,
        },
      },
      create: {
        workspaceId: args.workspaceId,
        source: args.source,
        externalRef: args.externalRef,
        payload: args.payload,
        occurredAt: args.occurredAt ?? null,
      },
      update: {
        payload: args.payload,
        occurredAt: args.occurredAt ?? undefined,
      },
    });

    await tx.auditEvent.create({
      data: {
        workspaceId: args.workspaceId,
        userId: "system",
        action: "INGEST_PARKED",
        resourceType: "workspace",
        resourceId: args.workspaceId,
        metadata: {
          source: args.source,
          externalRef: args.externalRef,
          note: "Ingest refused because no media posture decision exists. Replay from the parked recordings list after the CCO decides.",
        },
      },
    });
  });
}

/**
 * Mark a parked row ingested when a later successful ingest matches it.
 * No-op when nothing was parked for this ref.
 */
export async function resolveParkedIngest(args: {
  workspaceId: string;
  source: ParkedIngestSource;
  externalRef: string;
  meetingId: string;
}): Promise<void> {
  await db.parkedIngest.updateMany({
    where: {
      workspaceId: args.workspaceId,
      source: args.source,
      externalRef: args.externalRef,
      deletedAt: null,
      status: { not: "INGESTED" },
    },
    data: {
      status: "INGESTED",
      meetingId: args.meetingId,
    },
  });
}

export type ParkedIngestDto = {
  id: string;
  source: string;
  externalRef: string;
  occurredAt: string | null;
  parkedAt: string;
  status: string;
};

export async function listParkedIngests(
  workspaceId: string,
): Promise<ParkedIngestDto[]> {
  const rows = await db.parkedIngest.findMany({
    where: { workspaceId, deletedAt: null, status: { not: "INGESTED" } },
    orderBy: [{ parkedAt: "asc" }, { id: "asc" }],
  });

  return rows.map((row) => ({
    id: row.id,
    source: row.source,
    externalRef: row.externalRef,
    occurredAt: row.occurredAt ? row.occurredAt.toISOString() : null,
    parkedAt: row.parkedAt.toISOString(),
    status: row.status,
  }));
}

export type ReplayResult =
  | { success: true }
  | { success: false; status: number; error: string };

/**
 * Re-publish the original ingest job for a parked recording. OWNER_CCO only —
 * this is the explicit human action required because the posture decision was
 * made after the recording arrived.
 */
export async function replayParkedIngest(args: {
  workspaceId: string;
  parkedIngestId: string;
  userId: string;
  actorRole: string | null | undefined;
}): Promise<ReplayResult> {
  if (args.actorRole !== "OWNER_CCO") {
    return {
      success: false,
      status: 403,
      error: "Only the workspace CCO can replay parked recordings.",
    };
  }

  const parked = await db.parkedIngest.findFirst({
    where: { id: args.parkedIngestId, workspaceId: args.workspaceId, deletedAt: null },
  });

  if (!parked) {
    return { success: false, status: 404, error: "Parked recording not found" };
  }
  if (parked.status === "INGESTED") {
    return { success: false, status: 409, error: "This recording was already ingested" };
  }

  const workspace = await db.workspace.findUnique({
    where: { id: args.workspaceId },
    select: { mediaPosture: true },
  });
  if (!workspace?.mediaPosture) {
    return {
      success: false,
      status: 409,
      error: "Record the media posture decision before replaying parked recordings.",
    };
  }

  const qstash = await import("~/server/qstash");
  let jobId: string | null = null;

  if (parked.source === "zoom") {
    jobId = await qstash.publishZoomIngestionJob(
      // CAST: payload was serialised from ZoomIngestionPayload at park time
      parked.payload as Parameters<typeof qstash.publishZoomIngestionJob>[0],
    );
  } else if (parked.source === "teams") {
    jobId = await qstash.publishTeamsIngestionJob(
      // CAST: payload was serialised from TeamsIngestionPayload at park time
      parked.payload as Parameters<typeof qstash.publishTeamsIngestionJob>[0],
    );
  } else {
    return { success: false, status: 400, error: "Unknown ingest source" };
  }

  if (!jobId) {
    return {
      success: false,
      status: 502,
      error: "Failed to enqueue replay job. Try again.",
    };
  }

  await db.$transaction(async (tx) => {
    await tx.parkedIngest.update({
      where: { id: parked.id },
      data: {
        status: "REPLAY_REQUESTED",
        replayRequestedAt: new Date(),
        replayRequestedById: args.userId,
      },
    });

    await tx.auditEvent.create({
      data: {
        workspaceId: args.workspaceId,
        userId: args.userId,
        action: "INGEST_REPLAYED",
        resourceType: "workspace",
        resourceId: args.workspaceId,
        metadata: {
          parkedIngestId: parked.id,
          source: parked.source,
          externalRef: parked.externalRef,
        },
      },
    });
  });

  return { success: true };
}
