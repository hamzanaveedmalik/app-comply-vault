import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { getEntitlements } from "~/server/billing/entitlements";
import {
  activePendingInvitationWhere,
  getInvitationStatus,
  invitationRoleLabel,
} from "~/lib/invitation-utils";
import { activeUserWorkspaceWhere } from "~/lib/user-workspace-filters";
import type { WorkspaceRoleKey } from "~/lib/role-config";

async function assertOwnerAccess(
  workspaceId: string,
  userId: string,
): Promise<Response | null> {
  const membership = await db.userWorkspace.findFirst({
    where: {
      userId,
      workspaceId,
      role: "OWNER_CCO",
      ...activeUserWorkspaceWhere,
    },
  });

  if (!membership) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  return null;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ workspaceId: string }> },
): Promise<Response> {
  try {
    const session = await auth();
    if (!session?.user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { workspaceId } = await params;
    const forbidden = await assertOwnerAccess(workspaceId, session.user.id);
    if (forbidden) {
      return forbidden;
    }

    const [invitations, memberCount, pendingCount, workspace] = await Promise.all([
      db.invitation.findMany({
        where: {
          workspaceId,
          acceptedAt: null,
        },
        include: {
          invitedBy: { select: { name: true, email: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      db.userWorkspace.count({ where: { workspaceId, ...activeUserWorkspaceWhere } }),
      db.invitation.count({
        where: { workspaceId, ...activePendingInvitationWhere() },
      }),
      db.workspace.findUnique({
        where: { id: workspaceId },
        select: { planTier: true, billingStatus: true, trialEndsAt: true },
      }),
    ]);

    const maxUsers = workspace ? getEntitlements(workspace).maxUsers : 0;

    return Response.json({
      invitations: invitations.map((invitation) => {
        const status = getInvitationStatus(invitation)!;
        return {
          id: invitation.id,
          email: invitation.email,
          role: invitation.role,
          roleLabel: invitationRoleLabel(invitation.role as WorkspaceRoleKey),
          status,
          createdAt: invitation.createdAt.toISOString(),
          expiresAt: invitation.expiresAt.toISOString(),
          inviterName:
            invitation.invitedBy?.name ?? invitation.invitedBy?.email ?? null,
        };
      }),
      seats: {
        used: memberCount + pendingCount,
        members: memberCount,
        pending: pendingCount,
        max: maxUsers,
      },
    });
  } catch (error) {
    console.error("Error listing pending invitations:", error);
    return Response.json({ error: "Failed to list invitations" }, { status: 500 });
  }
}
