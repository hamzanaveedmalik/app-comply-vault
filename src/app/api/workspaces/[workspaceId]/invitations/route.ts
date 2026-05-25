import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { z } from "zod";
import { assertCanInvite } from "~/server/billing/guards";
import {
  createOrRenewInvitation,
  getInviterDetails,
} from "~/server/invitations/invitation-service";

const inviteUserSchema = z.object({
  email: z.string().email("Invalid email address"),
  role: z.enum(["OWNER_CCO", "MEMBER", "ADVISOR"]),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ workspaceId: string }> },
): Promise<Response> {
  try {
    const session = await auth();
    if (!session?.user) {
      return new Response("Unauthorized", { status: 401 });
    }

    const { workspaceId } = await params;
    const body = await request.json();
    const { email, role } = inviteUserSchema.parse(body);

    const ipAddress =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      request.headers.get("x-real-ip");
    const userAgent = request.headers.get("user-agent");

    await db.user.upsert({
      where: { id: session.user.id },
      create: {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
        image: session.user.image,
      },
      update: {
        email: session.user.email,
        name: session.user.name,
        image: session.user.image,
      },
    });

    if (session.user.role !== "OWNER_CCO") {
      return new Response("Forbidden: Only workspace owners can invite users", {
        status: 403,
      });
    }

    const workspace = await db.workspace.findFirst({
      where: {
        id: workspaceId,
        users: {
          some: {
            userId: session.user.id,
            role: "OWNER_CCO",
          },
        },
      },
    });

    if (!workspace) {
      return new Response("Workspace not found or access denied", {
        status: 404,
      });
    }

    const existingMembership = await db.userWorkspace.findFirst({
      where: {
        workspaceId,
        user: { email },
      },
    });

    if (existingMembership) {
      return Response.json(
        { error: "User is already a member of this workspace" },
        { status: 400 },
      );
    }

    const existingInvitation = await db.invitation.findUnique({
      where: { workspaceId_email: { workspaceId, email } },
    });

    const isActivePending =
      existingInvitation &&
      !existingInvitation.acceptedAt &&
      !existingInvitation.revokedAt &&
      existingInvitation.expiresAt > new Date();

    if (!isActivePending) {
      const gate = await assertCanInvite(workspaceId);
      if (!gate.ok) {
        return Response.json({ error: gate.error }, { status: gate.status });
      }
    }

    const inviter = await getInviterDetails(session.user.id, workspaceId);
    const result = await createOrRenewInvitation({
      workspaceId,
      workspaceName: workspace.name,
      email,
      role,
      invitedById: session.user.id,
      inviter,
      ipAddress,
      userAgent,
      auditAction: isActivePending ? "INVITE_RESENT" : "INVITE_SENT",
    });

    const invitation = await db.invitation.findUnique({
      where: { id: result.invitationId },
    });

    if (isActivePending && !result.renewed) {
      return Response.json(
        { message: "Invitation resent successfully", invitationId: result.invitationId },
        { status: 200 },
      );
    }

    return Response.json(
      {
        invitation: {
          id: result.invitationId,
          email,
          role,
          expiresAt: invitation?.expiresAt,
        },
      },
      { status: result.renewed ? 200 : 201 },
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ error: error.errors }, { status: 400 });
    }
    console.error("Error creating invitation:", error);
    return Response.json({ error: "Failed to create invitation" }, { status: 500 });
  }
}
