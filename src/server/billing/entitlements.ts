import type { BillingStatus, PlanTier, Workspace } from "@prisma/client";

export type Entitlements = {
  maxUsers: number;
  maxUploadsPerPeriod: number;
  allowApiAccess: boolean;
  allowZipExport: boolean;
  exportsWatermarked: boolean;
};

export const ENTITLEMENTS: Record<PlanTier, Entitlements> = {
  FREE: {
    maxUsers: 1,
    maxUploadsPerPeriod: 0,
    allowApiAccess: false,
    allowZipExport: false,
    exportsWatermarked: true,
  },
  SOLO: {
    maxUsers: 1,
    maxUploadsPerPeriod: 10,
    allowApiAccess: false,
    allowZipExport: false,
    exportsWatermarked: false,
  },
  TEAM: {
    maxUsers: 10,
    maxUploadsPerPeriod: 50,
    allowApiAccess: true,
    allowZipExport: true,
    exportsWatermarked: false,
  },
};

const TRIAL_ENTITLEMENTS: Entitlements = {
  maxUsers: 1,
  maxUploadsPerPeriod: 3,
  allowApiAccess: false,
  allowZipExport: false,
  exportsWatermarked: true,
};

export function isPaywallBypassed(status: BillingStatus) {
  return status === "PILOT";
}

export function isTrialExpired(trialEndsAt: Date | null) {
  if (!trialEndsAt) {
    return false;
  }
  return trialEndsAt.getTime() < Date.now();
}

export function getEntitlements(
  workspace: Pick<Workspace, "billingStatus" | "planTier" | "trialEndsAt">
) {
  if (isPaywallBypassed(workspace.billingStatus)) {
    return ENTITLEMENTS.TEAM;
  }

  if (workspace.billingStatus === "TRIALING") {
    return TRIAL_ENTITLEMENTS;
  }

  return ENTITLEMENTS[workspace.planTier] ?? ENTITLEMENTS.FREE;
}
