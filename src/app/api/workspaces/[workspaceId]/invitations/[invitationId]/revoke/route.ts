import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { getInvitationStatus } from "~/lib/invitation-utils";
import { activeUserWorkspaceWhere } from "~/lib/user-workspace-filters";

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

export async function POST(
  request: Request,
  { params }: { params: Promise<{ workspaceId: string; invitationId: string }> },
): Promise<Response> {
  try {
    const session = await auth();
    if (!session?.user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { workspaceId, invitationId } = await params;
    const forbidden = await assertOwnerAccess(workspaceId, session.user.id);
    if (forbidden) {
      return forbidden;
    }

    const invitation = await db.invitation.findFirst({
      where: { id: invitationId, workspaceId },
    });

    if (!invitation) {
      return Response.json({ error: "Invitation not found" }, { status: 404 });
    }

    if (invitation.acceptedAt) {
      return Response.json({ error: "Invitation already accepted" }, { status: 400 });
    }

    if (invitation.revokedAt) {
      return Response.json({ message: "Invitation already revoked" }, { status: 200 });
    }

    const ipAddress =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      request.headers.get("x-real-ip");
    const userAgent = request.headers.get("user-agent");

    await db.invitation.update({
      where: { id: invitationId },
      data: { revokedAt: new Date() },
    });

    await db.auditEvent.create({
      data: {
        workspaceId,
        userId: session.user.id,
        action: "INVITE_REVOKED",
        resourceType: "invitation",
        resourceId: invitationId,
        metadata: {
          email: invitation.email,
          role: invitation.role,
          previousStatus: getInvitationStatus(invitation),
          ipAddress,
          userAgent,
        },
      },
    });

    return Response.json({ success: true });
  } catch (error) {
    console.error("Error revoking invitation:", error);
    return Response.json({ error: "Failed to revoke invitation" }, { status: 500 });
  }
}
