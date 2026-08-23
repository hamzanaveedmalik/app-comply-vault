/**
 * Resolve which partner portfolio snapshot set applies to the signed-in user.
 */

import { db } from "~/server/db";
import { activeUserWorkspaceWhere } from "~/lib/user-workspace-filters";
import { RIACT_ONBOARDING_TYPE } from "~/server/demo/riact/tenant";
import {
  listPartnerFirmSnapshots,
  type PartnerFirmSnapshot,
} from "~/server/partner/snapshots";
import { RIACT_PARTNER_FIRM_SNAPSHOTS } from "~/server/partner/riact-snapshots";

export type PartnerSnapshotTenant = "default" | "riact";

export async function resolvePartnerSnapshotTenant(
  userId: string,
): Promise<PartnerSnapshotTenant> {
  const riactMembership = await db.userWorkspace.findFirst({
    where: {
      userId,
      ...activeUserWorkspaceWhere,
      workspace: { onboardingType: RIACT_ONBOARDING_TYPE },
    },
    select: { workspaceId: true },
  });
  return riactMembership ? "riact" : "default";
}

export async function listPartnerSnapshotsForUser(
  userId: string,
): Promise<{ tenant: PartnerSnapshotTenant; snapshots: PartnerFirmSnapshot[] }> {
  const tenant = await resolvePartnerSnapshotTenant(userId);
  return {
    tenant,
    snapshots:
      tenant === "riact"
        ? RIACT_PARTNER_FIRM_SNAPSHOTS.map((s) => ({ ...s }))
        : listPartnerFirmSnapshots(),
  };
}
