import { db } from "~/server/db";
import { activeUserWorkspaceWhere } from "~/lib/user-workspace-filters";

/** Where to send a user who has no active workspace membership. */
export async function pathForUserWithoutActiveWorkspace(
  userId: string,
  email: string | null | undefined,
): Promise<string> {
  const wasRemoved = await db.userWorkspace.findFirst({
    where: { userId, removedAt: { not: null } },
    select: { userId: true },
  });
  if (wasRemoved) {
    return "/no-workspace";
  }

  if (email) {
    const pendingInvitation = await db.invitation.findFirst({
      where: {
        email,
        acceptedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
    });
    if (pendingInvitation) {
      return `/invitations/accept?token=${pendingInvitation.token}`;
    }
  }

  return "/workspaces/new";
}

/** Post-auth / guard redirect when the user has no active workspace in session. */
export async function redirectPathForMissingWorkspace(
  userId: string,
  email: string | null | undefined,
  options?: { intentQuery?: string },
): Promise<string> {
  const path = await pathForUserWithoutActiveWorkspace(userId, email);
  if (path === "/workspaces/new" && options?.intentQuery) {
    return `/workspaces/new${options.intentQuery}`;
  }
  return path;
}
