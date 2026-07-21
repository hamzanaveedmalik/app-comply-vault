/**
 * Load open email-sourced flags for the Review Queue.
 */

import { db } from "~/server/db";
import type { FlagTriageCardFlag } from "~/components/flags/flag-triage-card";
import type { CmFlagDisposition, FlagStatus } from "../../../generated/prisma";

export async function listOpenEmailFlagsForReview(
  workspaceId: string
): Promise<FlagTriageCardFlag[]> {
  const flags = await db.flag.findMany({
    where: {
      workspaceId,
      sourceType: "EMAIL",
      status: { in: ["OPEN", "IN_REMEDIATION", "PENDING_VERIFICATION"] },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      resolutionRecord: {
        include: {
          tasks: true,
          evidence: true,
          verifications: true,
        },
      },
      communication: {
        select: {
          id: true,
          threadId: true,
          evidenceItem: { select: { title: true } },
        },
      },
    },
  });

  return flags.map((f) => ({
    id: f.id,
    type: f.type,
    severity: f.severity,
    status: f.status as FlagStatus,
    evidence: f.evidence,
    createdAt: f.createdAt.toISOString(),
    cmDisposition: f.cmDisposition as CmFlagDisposition,
    escalationReason: f.escalationReason,
    cmTriageNote: f.cmTriageNote,
    resolutionNote: f.resolutionNote,
    sourceType: "EMAIL" as const,
    sourceHref: f.communication?.threadId
      ? `/communications/threads/${f.communication.threadId}`
      : f.sourceId
        ? `/communications/threads/${f.sourceId}`
        : null,
    sourceLabel: f.communication?.evidenceItem?.title ?? "Open thread",
    resolutionRecord: f.resolutionRecord
      ? {
          id: f.resolutionRecord.id,
          resolutionType: f.resolutionRecord.resolutionType,
          rationale: f.resolutionRecord.rationale,
          metadata: f.resolutionRecord.metadata,
          submittedForVerificationAt:
            f.resolutionRecord.submittedForVerificationAt?.toISOString() ?? null,
          closedAt: f.resolutionRecord.closedAt?.toISOString() ?? null,
          overrideReason: f.resolutionRecord.overrideReason,
          overrideCategory: f.resolutionRecord.overrideCategory,
          tasks: f.resolutionRecord.tasks.map((t) => ({
            id: t.id,
            title: t.title,
            status: t.status,
            ownerId: t.ownerId,
            dueDate: t.dueDate.toISOString(),
            required: t.required,
            completionNote: t.completionNote,
            completedAt: t.completedAt?.toISOString() ?? null,
          })),
          evidence: f.resolutionRecord.evidence.map((e) => ({
            id: e.id,
            type: e.type,
            label: e.label,
            url: e.url,
            metadata: e.metadata,
            createdAt: e.createdAt.toISOString(),
          })),
          verifications: f.resolutionRecord.verifications.map((v) => ({
            id: v.id,
            reviewerId: v.reviewerId,
            decision: v.decision,
            note: v.note,
            decidedAt: v.decidedAt.toISOString(),
          })),
        }
      : null,
  }));
}
