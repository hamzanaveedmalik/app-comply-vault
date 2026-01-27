import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { z } from "zod";

const acceptInvitationSchema = z.object({
  token: z.string().min(1, "Token is required"),
});

export async function POST(request: Request) {
  try {
    const session = await auth();
    const body = await request.json();
    const { token } = acceptInvitationSchema.parse(body);

    const ipAddress =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      request.headers.get("x-real-ip");
    const userAgent = request.headers.get("user-agent");

    // Verify invitation
    const invitation = await db.invitation.findUnique({
      where: { token },
      include: {
        workspace: true,
      },
    });

    if (!invitation) {
      return Response.json(
        { error: "Invitation not found" },
        { status: 404 }
      );
    }

    if (invitation.acceptedAt) {
      return Response.json(
        { error: "This invitation has already been accepted" },
        { status: 400 }
      );
    }

    if (invitation.expiresAt < new Date()) {
      return Response.json(
        { error: "This invitation has expired" },
        { status: 400 }
      );
    }

    // If user is not authenticated, require sign in
    if (!session?.user) {
      return Response.json(
        { requiresAuth: true, error: "Please sign in to accept the invitation" },
        { status: 401 }
      );
    }

    // Verify email matches (if user is authenticated)
    if (session.user.email !== invitation.email) {
      return Response.json(
        {
          error: "This invitation was sent to a different email address. Please sign in with the email that received the invitation.",
        },
        { status: 403 }
      );
    }

    // Check if user is already a member
    const existingMembership = await db.userWorkspace.findFirst({
      where: {
        userId: session.user.id,
        workspaceId: invitation.workspaceId,
      },
    });

    if (existingMembership) {
      // User is already a member, just mark invitation as accepted
      await db.invitation.update({
        where: { id: invitation.id },
        data: { acceptedAt: new Date() },
      });

      return Response.json({
        message: "You are already a member of this workspace",
        workspaceId: invitation.workspaceId,
      });
    }

    // Create UserWorkspace record
    await db.userWorkspace.create({
      data: {
        userId: session.user.id,
        workspaceId: invitation.workspaceId,
        role: invitation.role,
      },
    });

    // Mark invitation as accepted
    await db.invitation.update({
      where: { id: invitation.id },
      data: { acceptedAt: new Date() },
    });

    // Log invitation acceptance
    await db.auditEvent.create({
      data: {
        workspaceId: invitation.workspaceId,
        userId: session.user.id,
        action: "INVITE_ACCEPTED",
        resourceType: "invitation",
        resourceId: invitation.id,
        metadata: {
          action: "invitation_accepted",
          role: invitation.role,
          ipAddress,
          userAgent,
        },
      },
    });

    return Response.json({
      message: "Invitation accepted successfully",
      workspaceId: invitation.workspaceId,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ error: error.errors }, { status: 400 });
    }
    console.error("Error accepting invitation:", error);
    return Response.json(
      { error: "Failed to accept invitation" },
      { status: 500 }
    );
  }
}

