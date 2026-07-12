/**
 * Mailbox ingest job processor — backfill + delta sync.
 * Epic B CV-B-03, CV-B-04
 */

import { db } from "~/server/db";
import {
  fetchMessagesPage,
  fetchDeltaPage,
} from "./graph-client";
import { isFolderInScope } from "./scope";
import { getConnectionAccessToken } from "./m365-auth";
import { ingestGraphMessage } from "./ingest-message";

export type IngestJobStats = {
  processed: number;
  created: number;
  skippedDuplicate: number;
  skippedOutOfScope: number;
  errors: number;
  folderCursors: Record<
    string,
    { nextLink?: string | null; deltaLink?: string | null }
  >;
};

function emptyStats(): IngestJobStats {
  return {
    processed: 0,
    created: 0,
    skippedDuplicate: 0,
    skippedOutOfScope: 0,
    errors: 0,
    folderCursors: {},
  };
}

function mergeStats(
  base: IngestJobStats,
  patch: Partial<IngestJobStats>
): IngestJobStats {
  return {
    processed: base.processed + (patch.processed ?? 0),
    created: base.created + (patch.created ?? 0),
    skippedDuplicate:
      base.skippedDuplicate + (patch.skippedDuplicate ?? 0),
    skippedOutOfScope:
      base.skippedOutOfScope + (patch.skippedOutOfScope ?? 0),
    errors: base.errors + (patch.errors ?? 0),
    folderCursors: { ...base.folderCursors, ...(patch.folderCursors ?? {}) },
  };
}

export async function processIngestJob(jobId: string): Promise<void> {
  const job = await db.ingestJob.findUnique({ where: { id: jobId } });
  if (!job || !job.connectionId) {
    throw new Error("Ingest job or connection missing");
  }

  const connection = await db.mailboxConnection.findFirst({
    where: {
      id: job.connectionId,
      workspaceId: job.workspaceId,
      deletedAt: null,
    },
  });
  if (!connection) throw new Error("Mailbox connection not found");

  await db.ingestJob.update({
    where: { id: jobId },
    data: { status: "RUNNING" },
  });

  if (connection.status === "PENDING") {
    await db.mailboxConnection.update({
      where: { id: connection.id },
      data: { status: "BACKFILLING" },
    });
  }

  let stats = (job.stats as IngestJobStats | null) ?? emptyStats();

  try {
    const accessToken = await getConnectionAccessToken({
      workspaceId: job.workspaceId,
      connectionId: connection.id,
    });

    const allowedFolders = connection.scopeFolders.filter(Boolean);
    if (allowedFolders.length === 0) {
      throw new Error("No folders in scope");
    }

    for (const folderId of allowedFolders) {
      if (!isFolderInScope(folderId, allowedFolders)) {
        stats = mergeStats(stats, { skippedOutOfScope: 1 });
        continue;
      }

      if (job.kind === "BACKFILL") {
        stats = await runBackfillForFolder({
          jobId,
          workspaceId: job.workspaceId,
          connectionId: connection.id,
          mailboxAddress: connection.mailboxAddress,
          accessToken,
          folderId,
          backfillFrom: connection.backfillFrom,
          stats,
        });
      } else if (job.kind === "DELTA") {
        stats = await runDeltaForFolder({
          workspaceId: job.workspaceId,
          connectionId: connection.id,
          mailboxAddress: connection.mailboxAddress,
          accessToken,
          folderId,
          deltaLink:
            stats.folderCursors[folderId]?.deltaLink ??
            connection.deltaCursor,
          stats,
        });
      }
    }

    await db.$transaction(async (tx) => {
      await tx.ingestJob.update({
        where: { id: jobId },
        data: {
          status: "DONE",
          stats,
          cursor: JSON.stringify(stats.folderCursors),
        },
      });
      await tx.mailboxConnection.update({
        where: { id: connection.id },
        data: {
          status: "ACTIVE",
          lastSyncAt: new Date(),
          lastErrorMessage: null,
          deltaCursor: JSON.stringify(stats.folderCursors),
        },
      });
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "ingest_failed";
    await db.$transaction(async (tx) => {
      await tx.ingestJob.update({
        where: { id: jobId },
        data: { status: "FAILED", stats, errorMessage: message },
      });
      await tx.mailboxConnection.update({
        where: { id: connection.id },
        data: { status: "ERROR", lastErrorMessage: message },
      });
    });
    throw err;
  }
}

async function runBackfillForFolder(args: {
  jobId: string;
  workspaceId: string;
  connectionId: string;
  mailboxAddress: string;
  accessToken: string;
  folderId: string;
  backfillFrom: Date | null;
  stats: IngestJobStats;
}): Promise<IngestJobStats> {
  let stats = { ...args.stats };
  const cursor = stats.folderCursors[args.folderId] ?? {};
  let nextLink = cursor.nextLink ?? null;
  let pages = 0;

  while (pages < 200) {
    const page = await fetchMessagesPage({
      accessToken: args.accessToken,
      mailboxAddress: args.mailboxAddress,
      folderId: args.folderId,
      backfillFrom: args.backfillFrom,
      nextLink,
    });

    for (const message of page.value) {
      stats.processed += 1;
      const result = await ingestGraphMessage({
        workspaceId: args.workspaceId,
        connectionId: args.connectionId,
        mailboxAddress: args.mailboxAddress,
        accessToken: args.accessToken,
        message,
        allowedFolderIds: [args.folderId],
        currentFolderId: args.folderId,
      });

      if (result.status === "created") stats.created += 1;
      else if (result.status === "duplicate") stats.skippedDuplicate += 1;
      else if (result.reason === "folder_out_of_scope")
        stats.skippedOutOfScope += 1;
      else stats.errors += 1;
    }

    nextLink = page["@odata.nextLink"] ?? null;
    stats.folderCursors[args.folderId] = {
      ...stats.folderCursors[args.folderId],
      nextLink,
      deltaLink: page["@odata.deltaLink"] ?? cursor.deltaLink,
    };

    await db.ingestJob.update({
      where: { id: args.jobId },
      data: { stats, cursor: JSON.stringify(stats.folderCursors) },
    });

    if (!nextLink) break;
    pages += 1;
  }

  return stats;
}

async function runDeltaForFolder(args: {
  workspaceId: string;
  connectionId: string;
  mailboxAddress: string;
  accessToken: string;
  folderId: string;
  deltaLink?: string | null;
  stats: IngestJobStats;
}): Promise<IngestJobStats> {
  let stats = { ...args.stats };
  let deltaLink = args.deltaLink ?? null;
  let pages = 0;

  while (pages < 50) {
    const page = await fetchDeltaPage({
      accessToken: args.accessToken,
      mailboxAddress: args.mailboxAddress,
      folderId: args.folderId,
      deltaLink,
    });

    for (const message of page.value) {
      stats.processed += 1;
      const result = await ingestGraphMessage({
        workspaceId: args.workspaceId,
        connectionId: args.connectionId,
        mailboxAddress: args.mailboxAddress,
        accessToken: args.accessToken,
        message,
        allowedFolderIds: [args.folderId],
        currentFolderId: args.folderId,
      });
      if (result.status === "created") stats.created += 1;
      else if (result.status === "duplicate") stats.skippedDuplicate += 1;
      else stats.errors += 1;
    }

    deltaLink = page["@odata.deltaLink"] ?? page["@odata.nextLink"] ?? null;
    stats.folderCursors[args.folderId] = {
      deltaLink,
      nextLink: null,
    };

    if (!page["@odata.nextLink"]) break;
    pages += 1;
  }

  return stats;
}

export async function startMailboxSync(args: {
  workspaceId: string;
  connectionId: string;
  kind: "BACKFILL" | "DELTA";
  userId: string;
}): Promise<{ jobId: string }> {
  const connection = await db.mailboxConnection.findFirst({
    where: {
      id: args.connectionId,
      workspaceId: args.workspaceId,
      deletedAt: null,
    },
  });
  if (!connection) throw new Error("Connection not found");
  if (connection.scopeFolders.length === 0) {
    throw new Error("Select at least one folder before syncing");
  }

  const job = await db.ingestJob.create({
    data: {
      workspaceId: args.workspaceId,
      connectionId: args.connectionId,
      kind: args.kind,
      status: "QUEUED",
      stats: emptyStats(),
    },
  });

  await db.auditEvent.create({
    data: {
      workspaceId: args.workspaceId,
      userId: args.userId,
      action: "MAILBOX_SYNC_STARTED",
      resourceType: "mailbox_connection",
      resourceId: args.connectionId,
      metadata: { jobId: job.id, kind: args.kind },
    },
  });

  return { jobId: job.id };
}
