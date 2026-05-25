import { randomBytes } from "crypto";
import type { WorkspaceRole } from "../../../generated/prisma";
import { db } from "~/server/db";
import { sendInvitationEmail } from "~/server/email";
import { roleLabel, type WorkspaceRoleKey } from "~/lib/role-config";
import { getInvitationStatus, isInvitationActive } from "~/lib/invitation-utils";

export type InviterDetails = {
  inviterName: string;
  inviterRole: string;
};

export async function getInviterDetails(
  userId: string,
  workspaceId: string,
): Promise<InviterDetails> {
  const membership = await db.userWorkspace.findUnique({
    where: {
      userId_workspaceId: { userId, workspaceId },
    },
    include: {
      user: { select: { name: true, email: true } },
    },
  });

  const name =
    membership?.user.name ?? membership?.user.email ?? "A team member";
  const inviterRole = membership
    ? roleLabel(membership.role as WorkspaceRoleKey)
    : "Owner / CCO";

  return { inviterName: name, inviterRole };
}

function newInvitationExpiry(): Date {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);
  return expiresAt;
}

export async function createOrRenewInvitation(params: {
  workspaceId: string;
  workspaceName: string;
  email: string;
  role: WorkspaceRole;
  invitedById: string;
  inviter: InviterDetails;
  ipAddress?: string | null;
  userAgent?: string | null;
  auditAction: "INVITE_SENT" | "INVITE_RESENT";
  auditMetadata?: Record<string, unknown>;
}): Promise<{ invitationId: string; token: string; renewed: boolean }> {
  const existingInvitation = await db.invitation.findUnique({
    where: {
      workspaceId_email: {
        workspaceId: params.workspaceId,
        email: params.email,
      },
    },
  });

  if (existingInvitation && !existingInvitation.acceptedAt) {
    if (isInvitationActive(existingInvitation)) {
      try {
        await sendInvitationEmail({
          email: params.email,
          workspaceName: params.workspaceName,
          invitationToken: existingInvitation.token,
          role: existingInvitation.role,
          inviterName: params.inviter.inviterName,
          inviterRole: params.inviter.inviterRole,
        });
      } catch (emailError) {
        console.error("Error resending invitation email:", emailError);
      }

      await db.auditEvent.create({
        data: {
          workspaceId: params.workspaceId,
          userId: params.invitedById,
          action: "INVITE_RESENT",
          resourceType: "invitation",
          resourceId: existingInvitation.id,
          metadata: {
            email: params.email,
            role: existingInvitation.role,
            action: "invitation_resent",
            ipAddress: params.ipAddress,
            userAgent: params.userAgent,
            ...params.auditMetadata,
          },
        },
      });

      return {
        invitationId: existingInvitation.id,
        token: existingInvitation.token,
        renewed: false,
      };
    }

    const token = randomBytes(32).toString("hex");
    const invitation = await db.invitation.update({
      where: { id: existingInvitation.id },
      data: {
        role: params.role,
        token,
        invitedById: params.invitedById,
        expiresAt: newInvitationExpiry(),
        revokedAt: null,
      },
    });

    try {
      await sendInvitationEmail({
        email: params.email,
        workspaceName: params.workspaceName,
        invitationToken: token,
        role: params.role,
        inviterName: params.inviter.inviterName,
        inviterRole: params.inviter.inviterRole,
      });
    } catch (emailError) {
      console.error("Error sending invitation email:", emailError);
    }

    await db.auditEvent.create({
      data: {
        workspaceId: params.workspaceId,
        userId: params.invitedById,
        action: params.auditAction,
        resourceType: "invitation",
        resourceId: invitation.id,
        metadata: {
          email: params.email,
          role: params.role,
          action: "invitation_renewed",
          previousStatus: getInvitationStatus(existingInvitation),
          ipAddress: params.ipAddress,
          userAgent: params.userAgent,
          ...params.auditMetadata,
        },
      },
    });

    return { invitationId: invitation.id, token, renewed: true };
  }

  const token = randomBytes(32).toString("hex");
  const invitation = await db.invitation.create({
    data: {
      workspaceId: params.workspaceId,
      email: params.email,
      role: params.role,
      token,
      invitedById: params.invitedById,
      expiresAt: newInvitationExpiry(),
    },
  });

  try {
    await sendInvitationEmail({
      email: params.email,
      workspaceName: params.workspaceName,
      invitationToken: token,
      role: params.role,
      inviterName: params.inviter.inviterName,
      inviterRole: params.inviter.inviterRole,
    });
  } catch (emailError) {
    console.error("Error sending invitation email:", emailError);
  }

  await db.auditEvent.create({
    data: {
      workspaceId: params.workspaceId,
      userId: params.invitedById,
      action: params.auditAction,
      resourceType: "invitation",
      resourceId: invitation.id,
      metadata: {
        email: params.email,
        role: params.role,
        action: "invitation_created",
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        ...params.auditMetadata,
      },
    },
  });

  return { invitationId: invitation.id, token, renewed: false };
}
