/**
 * CV-TR-04 — Workspace retention policy updates (no shortening).
 */

import { db } from "~/server/db";
import { computeExpiresAt, describeExpiryForSealToday } from "./fiscal-year";

export type RetentionUpdateInput = {
  retentionYears?: number;
  fiscalYearEndMonth?: number;
  fiscalTimezone?: string;
  legalHold?: boolean;
};

export type RetentionUpdateResult =
  | {
      success: true;
      data: {
        retentionYears: number;
        fiscalYearEndMonth: number;
        fiscalTimezone: string;
        legalHold: boolean;
        expiryPreview: string;
      };
    }
  | { success: false; error: string };

const IANA_TZ = /^[A-Za-z_]+\/[A-Za-z0-9_\-+]+$/;

export async function updateWorkspaceRetentionPolicy(args: {
  workspaceId: string;
  userId: string;
  input: RetentionUpdateInput;
}): Promise<RetentionUpdateResult> {
  const workspace = await db.workspace.findUnique({
    where: { id: args.workspaceId },
  });
  if (!workspace) {
    return { success: false, error: "Workspace not found" };
  }

  const nextYears = args.input.retentionYears ?? workspace.retentionYears;
  const nextMonth = args.input.fiscalYearEndMonth ?? workspace.fiscalYearEndMonth;
  const nextTz = args.input.fiscalTimezone ?? workspace.fiscalTimezone;
  const nextHold = args.input.legalHold ?? workspace.legalHold;

  if (nextYears < 5 || nextYears > 25) {
    return { success: false, error: "Retention years must be between 5 and 25" };
  }
  if (nextYears < workspace.retentionYears) {
    return {
      success: false,
      error: `Retention cannot be shortened (current floor is ${workspace.retentionYears} years). Increases are allowed.`,
    };
  }
  if (nextMonth < 1 || nextMonth > 12) {
    return { success: false, error: "Fiscal year end month must be 1-12" };
  }
  if (!IANA_TZ.test(nextTz)) {
    return { success: false, error: "Fiscal timezone must be a valid IANA name (e.g. America/New_York)" };
  }

  const yearsIncreased = nextYears > workspace.retentionYears;
  const monthChanged = nextMonth !== workspace.fiscalYearEndMonth;
  const tzChanged = nextTz !== workspace.fiscalTimezone;
  const holdChanged = nextHold !== workspace.legalHold;

  if (!yearsIncreased && !monthChanged && !tzChanged && !holdChanged) {
    return {
      success: true,
      data: {
        retentionYears: workspace.retentionYears,
        fiscalYearEndMonth: workspace.fiscalYearEndMonth,
        fiscalTimezone: workspace.fiscalTimezone,
        legalHold: workspace.legalHold,
        expiryPreview: describeExpiryForSealToday(new Date(), {
          retentionYears: workspace.retentionYears,
          fiscalYearEndMonth: workspace.fiscalYearEndMonth,
          fiscalTimezone: workspace.fiscalTimezone,
        }),
      },
    };
  }

  const updated = await db.$transaction(async (tx) => {
    const row = await tx.workspace.update({
      where: { id: args.workspaceId },
      data: {
        retentionYears: nextYears,
        fiscalYearEndMonth: nextMonth,
        fiscalTimezone: nextTz,
        legalHold: nextHold,
      },
    });

    await tx.auditEvent.create({
      data: {
        workspaceId: args.workspaceId,
        userId: args.userId,
        action: "RETENTION_POLICY_UPDATED",
        resourceType: "workspace",
        resourceId: args.workspaceId,
        metadata: {
          old: {
            retentionYears: workspace.retentionYears,
            fiscalYearEndMonth: workspace.fiscalYearEndMonth,
            fiscalTimezone: workspace.fiscalTimezone,
            legalHold: workspace.legalHold,
          },
          new: {
            retentionYears: nextYears,
            fiscalYearEndMonth: nextMonth,
            fiscalTimezone: nextTz,
            legalHold: nextHold,
          },
          note: yearsIncreased
            ? "Existing seals keep their original expiresAt; only new seals use the increased retention."
            : undefined,
        },
      },
    });

    return row;
  });

  return {
    success: true,
    data: {
      retentionYears: updated.retentionYears,
      fiscalYearEndMonth: updated.fiscalYearEndMonth,
      fiscalTimezone: updated.fiscalTimezone,
      legalHold: updated.legalHold,
      expiryPreview: describeExpiryForSealToday(new Date(), {
        retentionYears: updated.retentionYears,
        fiscalYearEndMonth: updated.fiscalYearEndMonth,
        fiscalTimezone: updated.fiscalTimezone,
      }),
    },
  };
}

export { computeExpiresAt, describeExpiryForSealToday };
