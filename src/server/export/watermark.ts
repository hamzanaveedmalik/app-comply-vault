/**
 * CV-TR-19 — sealed packs are never watermarked.
 *
 * Draft / convenience exports honour entitlement watermarking.
 * Sealed bytes must be entitlement-independent: the same record sealed under
 * a trial or paid workspace produces identical hashes.
 */

import type { BillingStatus, PlanTier } from "../../../generated/prisma";
import { getEntitlements, isTrialExpired } from "~/server/billing/entitlements";

export type ExportPurpose = "draft" | "seal";

export type WatermarkWorkspace = {
  billingStatus: BillingStatus;
  planTier: PlanTier;
  trialEndsAt: Date | null;
};

/**
 * Resolve whether an export should carry a trial/entitlement watermark.
 * Fail-closed for seals: purpose "seal" always returns false.
 */
export function resolveExportWatermark(args: {
  purpose: ExportPurpose;
  workspace: WatermarkWorkspace;
}): boolean {
  if (args.purpose === "seal") {
    return false;
  }

  const entitlements = getEntitlements({
    billingStatus: args.workspace.billingStatus,
    planTier: args.workspace.planTier,
    trialEndsAt: args.workspace.trialEndsAt,
  });
  const trialExpired =
    args.workspace.billingStatus === "TRIALING" &&
    isTrialExpired(args.workspace.trialEndsAt);

  return (entitlements?.exportsWatermarked ?? false) || trialExpired;
}
