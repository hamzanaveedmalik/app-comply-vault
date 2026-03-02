import type { BillingStatus, PlanTier, Workspace } from "../../../generated/prisma";

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
    maxUploadsPerPeriod: 3, // Free trial gets 3 uploads
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

const getTrialEntitlements = (planTier: PlanTier): Entitlements => {
  // For free trials, always limit to 1 user and low uploads
  // Even if they selected SOLO or TEAM plan, during trial they get limited access
  return {
    maxUsers: 1,
    maxUploadsPerPeriod: 3,
    allowApiAccess: false,
    allowZipExport: false,
    exportsWatermarked: true,
  };
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
    return getTrialEntitlements(workspace.planTier);
  }

  return ENTITLEMENTS[workspace.planTier] ?? ENTITLEMENTS.FREE;
}
