import type { Invitation } from "../../generated/prisma";
import { roleLabel, type WorkspaceRoleKey } from "./role-config";

export type InvitationDisplayStatus = "PENDING" | "EXPIRED" | "REVOKED";

export function getInvitationStatus(
  invitation: Pick<Invitation, "acceptedAt" | "expiresAt" | "revokedAt">,
  now: Date = new Date(),
): InvitationDisplayStatus | null {
  if (invitation.acceptedAt) {
    return null;
  }
  if (invitation.revokedAt) {
    return "REVOKED";
  }
  if (invitation.expiresAt < now) {
    return "EXPIRED";
  }
  return "PENDING";
}

export function isInvitationActive(
  invitation: Pick<Invitation, "acceptedAt" | "expiresAt" | "revokedAt">,
  now: Date = new Date(),
): boolean {
  return getInvitationStatus(invitation, now) === "PENDING";
}

export function invitationRoleLabel(role: WorkspaceRoleKey): string {
  return roleLabel(role);
}

/** Prisma where clause for invitations that consume a seat. */
export function activePendingInvitationWhere(now: Date = new Date()) {
  return {
    acceptedAt: null,
    revokedAt: null,
    expiresAt: { gt: now },
  } as const;
}
