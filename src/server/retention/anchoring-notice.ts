/**
 * CV-TR-04a — one-time fiscal-year retention anchoring notice for OWNER_CCO.
 */

import { db } from "~/server/db";

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

export type RetentionNoticeState = {
  pending: boolean;
  retentionYears: number;
  fiscalYearEndMonth: number;
  fiscalYearEndLabel: string;
  fiscalTimezone: string;
};

export async function getRetentionAnchoringNoticeState(
  workspaceId: string,
): Promise<RetentionNoticeState | null> {
  const workspace = await db.workspace.findUnique({
    where: { id: workspaceId },
    select: {
      retentionAnchoringNoticePending: true,
      retentionYears: true,
      fiscalYearEndMonth: true,
      fiscalTimezone: true,
    },
  });

  if (!workspace) return null;

  const monthIndex = Math.min(Math.max(workspace.fiscalYearEndMonth, 1), 12) - 1;
  return {
    pending: workspace.retentionAnchoringNoticePending,
    retentionYears: workspace.retentionYears,
    fiscalYearEndMonth: workspace.fiscalYearEndMonth,
    fiscalYearEndLabel: MONTH_NAMES[monthIndex] ?? "December",
    fiscalTimezone: workspace.fiscalTimezone,
  };
}

export type DismissNoticeResult =
  | { success: true }
  | { success: false; status: number; error: string };

/**
 * OWNER_CCO dismisses the one-time migration notice. Idempotent.
 */
export async function dismissRetentionAnchoringNotice(args: {
  workspaceId: string;
  userId: string;
  actorRole: string | null | undefined;
}): Promise<DismissNoticeResult> {
  if (args.actorRole !== "OWNER_CCO") {
    return {
      success: false,
      status: 403,
      error: "Only the workspace CCO can dismiss this notice.",
    };
  }

  const workspace = await db.workspace.findUnique({
    where: { id: args.workspaceId },
    select: { retentionAnchoringNoticePending: true },
  });
  if (!workspace) {
    return { success: false, status: 404, error: "Workspace not found" };
  }

  if (!workspace.retentionAnchoringNoticePending) {
    return { success: true };
  }

  await db.$transaction(async (tx) => {
    await tx.workspace.update({
      where: { id: args.workspaceId },
      data: { retentionAnchoringNoticePending: false },
    });

    await tx.auditEvent.create({
      data: {
        workspaceId: args.workspaceId,
        userId: args.userId,
        action: "RETENTION_POLICY_UPDATED",
        resourceType: "workspace",
        resourceId: args.workspaceId,
        metadata: {
          action: "retention_anchoring_notice_dismissed",
          note: "OWNER_CCO acknowledged the fiscal-year retention anchoring migration notice.",
        },
      },
    });
  });

  return { success: true };
}
