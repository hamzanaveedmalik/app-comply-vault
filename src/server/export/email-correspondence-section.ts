/**
 * Email Correspondence section for audit packs (Email Intelligence Phase 2).
 */

import { db } from "~/server/db";
import { getHouseholdClientIds } from "~/server/clients/household";

export type EmailCorrespondenceRow = {
  threadId: string;
  subject: string | null;
  messageId: string;
  sentAt: string;
  direction: string;
  fromAddress: string;
  contentSha256: string;
  classificationResult: string | null;
  flagTypes: string[];
  flagStatuses: string[];
  dispositions: string[];
  reviewerIds: string[];
  reviewedAt: string[];
};

export type EmailCorrespondenceSection = {
  clientId: string;
  clientName: string;
  from: string;
  to: string;
  coverage: {
    threadCount: number;
    messageCount: number;
    cleanCount: number;
    flaggedCount: number;
  };
  rows: EmailCorrespondenceRow[];
};

export async function buildEmailCorrespondenceSection(args: {
  workspaceId: string;
  clientId: string;
  from: Date;
  to: Date;
}): Promise<EmailCorrespondenceSection | null> {
  const client = await db.client.findFirst({
    where: {
      id: args.clientId,
      workspaceId: args.workspaceId,
      deletedAt: null,
    },
    select: { id: true, name: true },
  });
  if (!client) return null;

  const clientIds = await getHouseholdClientIds({
    workspaceId: args.workspaceId,
    clientId: client.id,
  });

  const evidenceItems = await db.evidenceItem.findMany({
    where: {
      workspaceId: args.workspaceId,
      clientId: { in: clientIds },
      sourceType: "EMAIL",
      deletedAt: null,
      occurredAt: { gte: args.from, lte: args.to },
    },
    orderBy: [{ occurredAt: "asc" }, { id: "asc" }],
    include: {
      communication: {
        include: {
          thread: { select: { id: true, subject: true } },
          flags: {
            include: {
              resolutionRecord: {
                select: {
                  rationale: true,
                  createdByUserId: true,
                  closedAt: true,
                  closedByUserId: true,
                },
              },
            },
          },
        },
      },
    },
  });

  const evidenceIds = evidenceItems.map((e) => e.id);
  const classifications =
    evidenceIds.length > 0
      ? await db.evidenceClassification.findMany({
          where: {
            workspaceId: args.workspaceId,
            evidenceItemId: { in: evidenceIds },
            deletedAt: null,
          },
          orderBy: { createdAt: "desc" },
        })
      : [];
  const classByEvidence = new Map<string, (typeof classifications)[0]>();
  for (const c of classifications) {
    if (!classByEvidence.has(c.evidenceItemId)) {
      classByEvidence.set(c.evidenceItemId, c);
    }
  }

  const rows: EmailCorrespondenceRow[] = [];
  const threadIds = new Set<string>();
  let cleanCount = 0;
  let flaggedCount = 0;

  for (const item of evidenceItems) {
    const comm = item.communication;
    if (!comm) continue;
    threadIds.add(comm.threadId);
    const classification = classByEvidence.get(item.id) ?? null;
    if (classification?.result === "CLEAN") cleanCount += 1;
    if (classification?.result === "FLAGGED" || (comm.flags?.length ?? 0) > 0) {
      flaggedCount += 1;
    }

    rows.push({
      threadId: comm.threadId,
      subject: comm.thread.subject,
      messageId: comm.id,
      sentAt: comm.sentAt.toISOString(),
      direction: comm.direction,
      fromAddress: comm.fromAddress,
      contentSha256: item.contentSha256,
      classificationResult: classification?.result ?? null,
      flagTypes: (comm.flags ?? []).map((f) => f.type),
      flagStatuses: (comm.flags ?? []).map((f) => f.status),
      dispositions: (comm.flags ?? []).map((f) =>
        [f.cmDisposition, f.resolutionNote ?? f.resolutionRecord?.rationale ?? ""]
          .filter(Boolean)
          .join(": ")
      ),
      reviewerIds: (comm.flags ?? [])
        .map(
          (f) =>
            f.cmTriagedByUserId ??
            f.resolutionRecord?.closedByUserId ??
            f.resolvedByUserId ??
            ""
        )
        .filter(Boolean),
      reviewedAt: (comm.flags ?? [])
        .map(
          (f) =>
            f.cmTriagedAt?.toISOString() ??
            f.resolutionRecord?.closedAt?.toISOString() ??
            f.resolvedAt?.toISOString() ??
            ""
        )
        .filter(Boolean),
    });
  }

  return {
    clientId: client.id,
    clientName: client.name,
    from: args.from.toISOString(),
    to: args.to.toISOString(),
    coverage: {
      threadCount: threadIds.size,
      messageCount: rows.length,
      cleanCount,
      flaggedCount,
    },
    rows,
  };
}

export function emailCorrespondenceSectionToCsv(
  section: EmailCorrespondenceSection
): string {
  const header = [
    "threadId",
    "subject",
    "messageId",
    "sentAt",
    "direction",
    "fromAddress",
    "contentSha256",
    "classificationResult",
    "flagTypes",
    "flagStatuses",
    "dispositions",
    "reviewerIds",
    "reviewedAt",
  ].join(",");

  const escape = (v: string): string => `"${v.replace(/"/g, '""')}"`;

  const lines = section.rows.map((r) =>
    [
      r.threadId,
      escape(r.subject ?? ""),
      r.messageId,
      r.sentAt,
      r.direction,
      escape(r.fromAddress),
      r.contentSha256,
      r.classificationResult ?? "",
      escape(r.flagTypes.join("|")),
      escape(r.flagStatuses.join("|")),
      escape(r.dispositions.join("|")),
      escape(r.reviewerIds.join("|")),
      escape(r.reviewedAt.join("|")),
    ].join(",")
  );

  const coverage = [
    `# Email Correspondence — ${section.clientName}`,
    `# Range: ${section.from} to ${section.to}`,
    `# Threads: ${section.coverage.threadCount}; Messages: ${section.coverage.messageCount}; CLEAN: ${section.coverage.cleanCount}; Flagged: ${section.coverage.flaggedCount}`,
  ].join("\n");

  return `${coverage}\n${header}\n${lines.join("\n")}\n`;
}
