import { db } from "~/server/db";
import { roleLabel, type WorkspaceRoleKey } from "~/lib/role-config";
import { getInvitationStatus } from "~/lib/invitation-utils";
import type { WorkspaceRole } from "../../../generated/prisma";

export type VerifyInvitationSuccess = {
  valid: true;
  workspaceName: string;
  role: WorkspaceRole;
  invitedEmail: string;
  inviterName: string | null;
  inviterRole: string | null;
  firmCRD: string | null;
};

export type VerifyInvitationError = {
  valid: false;
  errorType: "expired" | "invalid" | "accepted" | "error";
  message: string;
};

export async function verifyInvitationToken(
  token: string,
): Promise<VerifyInvitationSuccess | VerifyInvitationError> {
  try {
    const invitation = await db.invitation.findUnique({
      where: { token },
      include: {
        workspace: true,
      },
    });

    if (!invitation) {
      return {
        valid: false,
        errorType: "invalid",
        message: "This link is not valid. It may have been copied incorrectly or already used.",
      };
    }

    if (invitation.acceptedAt) {
      return {
        valid: false,
        errorType: "accepted",
        message: "This invitation has already been used. Sign in to access your workspace.",
      };
    }

    const status = getInvitationStatus(invitation);
    if (status === "REVOKED" || status === "EXPIRED") {
      return {
        valid: false,
        errorType: status === "EXPIRED" ? "expired" : "invalid",
        message:
          status === "EXPIRED"
            ? "This invitation is no longer valid. Ask the workspace owner to send a new one."
            : "This link is not valid. It may have been copied incorrectly or already used.",
      };
    }

    let inviterName: string | null = null;
    let inviterRole: string | null = null;

    if (invitation.invitedById) {
      const inviterMembership = await db.userWorkspace.findUnique({
        where: {
          userId_workspaceId: {
            userId: invitation.invitedById,
            workspaceId: invitation.workspaceId,
          },
        },
        include: {
          user: { select: { name: true, email: true } },
        },
      });

      if (inviterMembership) {
        inviterName =
          inviterMembership.user.name ??
          inviterMembership.user.email ??
          null;
        inviterRole = roleLabel(inviterMembership.role as WorkspaceRoleKey);
      } else {
        const inviter = await db.user.findUnique({
          where: { id: invitation.invitedById },
          select: { name: true, email: true },
        });
        inviterName = inviter?.name ?? inviter?.email ?? null;
      }
    }

    return {
      valid: true,
      workspaceName: invitation.workspace.name,
      role: invitation.role,
      invitedEmail: invitation.email,
      inviterName,
      inviterRole,
      firmCRD: null,
    };
  } catch (error) {
    console.error("Error verifying invitation:", error);
    return {
      valid: false,
      errorType: "error",
      message: "We couldn't verify this invitation. Please try again.",
    };
  }
}
