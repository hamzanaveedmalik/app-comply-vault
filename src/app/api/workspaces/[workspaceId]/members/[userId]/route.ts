import { auth } from "~/server/auth";
import { db } from "~/server/db";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ workspaceId: string; userId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.workspaceId || !session.user.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.user.role !== "OWNER_CCO") {
      return Response.json(
        { error: "Forbidden: Only workspace owners can remove members" },
        { status: 403 }
      );
    }

    const { workspaceId, userId } = await params;

    if (workspaceId !== session.user.workspaceId) {
      return Response.json({ error: "Workspace access denied" }, { status: 403 });
    }

    if (userId === session.user.id) {
      return Response.json({ error: "You cannot remove yourself" }, { status: 400 });
    }

    const membership = await db.userWorkspace.findFirst({
      where: {
        workspaceId,
        userId,
      },
      include: {
        user: true,
      },
    });

    if (!membership) {
      return Response.json({ error: "Member not found" }, { status: 404 });
    }

    if (membership.role === "OWNER_CCO") {
      const ownerCount = await db.userWorkspace.count({
        where: {
          workspaceId,
          role: "OWNER_CCO",
        },
      });
      if (ownerCount <= 1) {
        return Response.json(
          { error: "You must keep at least one Owner/CCO in the workspace" },
          { status: 400 }
        );
      }
    }

    const ipAddress =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      request.headers.get("x-real-ip");
    const userAgent = request.headers.get("user-agent");

    await db.userWorkspace.delete({
      where: {
        userId_workspaceId: {
          userId,
          workspaceId,
        },
      },
    });

    await db.auditEvent.create({
      data: {
        workspaceId,
        userId: session.user.id,
        action: "MEMBER_REMOVED",
        resourceType: "workspace",
        resourceId: workspaceId,
        metadata: {
          removedUserId: userId,
          removedEmail: membership.user.email,
          removedRole: membership.role,
          ipAddress,
          userAgent,
        },
      },
    });

    return Response.json({ success: true });
  } catch (error) {
    console.error("Error removing member:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to remove member" },
      { status: 500 }
    );
  }
}
