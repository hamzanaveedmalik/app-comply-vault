/**
 * CV-EA-02 — Source evidence link resolver.
 * Broken refs render as an explicit state, never silently omitted.
 */

import type { EvidenceRef, EvidenceRefResolveResult } from "./types";

type PrismaLike = {
  evidenceItem: {
    findFirst: (args: {
      where: Record<string, unknown>;
      select: Record<string, boolean>;
    }) => Promise<{
      id: string;
      title: string;
      contentSha256: string | null;
      communication: { threadId: string } | null;
    } | null>;
  };
  meeting: {
    findFirst: (args: {
      where: Record<string, unknown>;
      select: Record<string, boolean>;
    }) => Promise<{
      id: string;
      clientName: string;
      meetingDate: Date;
    } | null>;
  };
  version?: {
    findFirst: (args: {
      where: Record<string, unknown>;
      select: Record<string, boolean>;
    }) => Promise<{ id: string; meetingId: string } | null>;
  };
};

/**
 * Resolve an EvidenceRef to a viewable href within the same workspace.
 * Never follows refs across workspace boundaries.
 */
export async function resolveEvidenceRef(
  ref: EvidenceRef,
  prisma?: PrismaLike
): Promise<EvidenceRefResolveResult> {
  const database =
    prisma ??
    // CAST: Prisma's generated relation return types are narrower than this adapter contract.
    ((await import("~/server/db")).db as unknown as PrismaLike);
  if (ref.kind === "regulatory_citation") {
    return {
      status: "broken",
      reason:
        "Regulatory citations are not resolvable as firm evidence sources.",
    };
  }

  if (ref.kind === "policy_clause") {
    if (!ref.policyClauseId) {
      return { status: "broken", reason: "Missing policy clause id." };
    }
    return {
      status: "ok",
      href: `/compliance-cockpit#policy-${ref.policyClauseId}`,
      title: ref.label ?? `Policy clause ${ref.policyClauseId}`,
    };
  }

  if (
    ref.kind === "email_message" ||
    (ref.kind === "email_message" as EvidenceRef["kind"])
  ) {
    const item = await database.evidenceItem.findFirst({
      where: {
        id: ref.sourceId,
        workspaceId: ref.workspaceId,
        deletedAt: null,
      },
      select: {
        id: true,
        title: true,
        contentSha256: true,
        communication: true,
      },
    });
    if (!item) {
      return { status: "broken", reason: "Email evidence not found in workspace." };
    }
    const threadId = ref.threadId ?? item.communication?.threadId;
    if (!threadId) {
      return {
        status: "broken",
        reason: "Email evidence has no thread link.",
      };
    }
    return {
      status: "ok",
      href: `/mailbox/threads/${threadId}`,
      title: ref.label ?? item.title,
      sha256: item.contentSha256 ?? ref.sha256,
    };
  }

  if (
    ref.kind === "meeting" ||
    ref.kind === "meeting_offset" ||
    ref.kind === "transcript_segment"
  ) {
    const meeting = await database.meeting.findFirst({
      where: {
        id: ref.sourceId,
        workspaceId: ref.workspaceId,
      },
      select: { id: true, clientName: true, meetingDate: true },
    });
    if (!meeting) {
      return { status: "broken", reason: "Meeting not found in workspace." };
    }
    const hash =
      typeof ref.offsetSec === "number"
        ? `#t=${Math.floor(ref.offsetSec)}`
        : typeof ref.segmentIndex === "number"
          ? `#seg=${ref.segmentIndex}`
          : "";
    return {
      status: "ok",
      href: `/meetings/${meeting.id}${hash}`,
      title:
        ref.label ??
        `${meeting.clientName} · ${meeting.meetingDate.toISOString().slice(0, 10)}`,
      sha256: ref.sha256,
    };
  }

  if (ref.kind === "document_version") {
    const versionId = ref.documentVersionId ?? ref.sourceId;
    if (!database.version) {
      return { status: "broken", reason: "Document version lookup unavailable." };
    }
    const version = await database.version.findFirst({
      where: { id: versionId },
      select: { id: true, meetingId: true },
    });
    if (!version) {
      return { status: "broken", reason: "Document version not found." };
    }
    // Confirm meeting is in workspace
    const meeting = await database.meeting.findFirst({
      where: { id: version.meetingId, workspaceId: ref.workspaceId },
      select: { id: true, clientName: true, meetingDate: true },
    });
    if (!meeting) {
      return {
        status: "broken",
        reason: "Document version meeting not in workspace.",
      };
    }
    return {
      status: "ok",
      href: `/meetings/${meeting.id}?version=${version.id}`,
      title: ref.label ?? `Document version ${version.id}`,
      sha256: ref.sha256,
    };
  }

  return { status: "broken", reason: `Unsupported evidence ref kind: ${ref.kind}` };
}

/** Build EvidenceRef from an Ask citation. */
export function evidenceRefFromCitation(args: {
  workspaceId: string;
  sourceType: "MEETING" | "EMAIL";
  meetingId: string;
  threadId?: string;
  messageId?: string;
  contentSha256?: string;
  transcriptStartSec?: number;
  label?: string;
}): EvidenceRef {
  if (args.sourceType === "EMAIL") {
    return {
      kind: "email_message",
      workspaceId: args.workspaceId,
      sourceId: args.messageId ?? args.meetingId,
      threadId: args.threadId,
      sha256: args.contentSha256,
      label: args.label,
    };
  }
  if (typeof args.transcriptStartSec === "number") {
    return {
      kind: "meeting_offset",
      workspaceId: args.workspaceId,
      sourceId: args.meetingId,
      offsetSec: args.transcriptStartSec,
      sha256: args.contentSha256,
      label: args.label,
    };
  }
  return {
    kind: "meeting",
    workspaceId: args.workspaceId,
    sourceId: args.meetingId,
    sha256: args.contentSha256,
    label: args.label,
  };
}
