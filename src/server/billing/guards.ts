import type { Workspace } from "@prisma/client";
import { db } from "~/server/db";
import { getEntitlements, isPaywallBypassed, isTrialExpired } from "./entitlements";

const ACTIVE_STATUSES = ["ACTIVE", "TRIALING"] as const;

function getPeriodWindow(
  workspace: Pick<Workspace, "currentPeriodStart" | "currentPeriodEnd">
) {
  if (workspace.currentPeriodStart && workspace.currentPeriodEnd) {
    return { start: workspace.currentPeriodStart, end: workspace.currentPeriodEnd };
  }

  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0));
  return { start, end };
}

export async function assertCanUpload(workspaceId: string) {
  const workspace = await db.workspace.findUnique({
    where: { id: workspaceId },
    select: {
      billingStatus: true,
      planTier: true,
      currentPeriodStart: true,
      currentPeriodEnd: true,
      trialEndsAt: true,
    },
  });

  if (!workspace) {
    return { ok: false as const, status: 404, error: "Workspace not found" };
  }

  if (isPaywallBypassed(workspace.billingStatus)) {
    return { ok: true as const };
  }

  if (workspace.billingStatus === "TRIALING" && isTrialExpired(workspace.trialEndsAt)) {
    return {
      ok: false as const,
      status: 402,
      error: "Trial expired. Please upgrade to continue uploading meetings.",
    };
  }

  if (!ACTIVE_STATUSES.includes(workspace.billingStatus)) {
    return {
      ok: false as const,
      status: 402,
      error: "Subscription inactive. Please update billing to upload meetings.",
    };
  }

  const ent = getEntitlements(workspace);
  const { start, end } = getPeriodWindow(workspace);

  const uploadsThisPeriod = await db.meeting.count({
    where: {
      workspaceId,
      createdAt: { gte: start, lt: end },
    },
  });

  if (ent.maxUploadsPerPeriod === 0 || uploadsThisPeriod >= ent.maxUploadsPerPeriod) {
    return {
      ok: false as const,
      status: 402,
      error: `Upload limit reached (${uploadsThisPeriod}/${ent.maxUploadsPerPeriod}) for your plan.`,
    };
  }

  return { ok: true as const };
}

export async function assertCanInvite(workspaceId: string) {
  const workspace = await db.workspace.findUnique({
    where: { id: workspaceId },
    select: {
      billingStatus: true,
      planTier: true,
      trialEndsAt: true,
    },
  });

  if (!workspace) {
    return { ok: false as const, status: 404, error: "Workspace not found" };
  }

  if (isPaywallBypassed(workspace.billingStatus)) {
    return { ok: true as const };
  }

  if (workspace.billingStatus === "TRIALING" && isTrialExpired(workspace.trialEndsAt)) {
    return {
      ok: false as const,
      status: 402,
      error: "Trial expired. Please upgrade to invite users.",
    };
  }

  if (!ACTIVE_STATUSES.includes(workspace.billingStatus)) {
    return {
      ok: false as const,
      status: 402,
      error: "Subscription inactive. Please update billing to invite users.",
    };
  }

  const ent = getEntitlements(workspace);
  const memberCount = await db.userWorkspace.count({ where: { workspaceId } });
  const pendingInvites = await db.invitation.count({
    where: {
      workspaceId,
      acceptedAt: null,
      expiresAt: { gt: new Date() },
    },
  });

  const totalSeatsReserved = memberCount + pendingInvites;

  if (ent.maxUsers === 0 || totalSeatsReserved >= ent.maxUsers) {
    return {
      ok: false as const,
      status: 402,
      error: `User limit reached (${memberCount}/${ent.maxUsers}). Upgrade to add more seats.`,
    };
  }

  return { ok: true as const };
}
