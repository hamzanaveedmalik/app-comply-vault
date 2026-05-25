import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { z } from "zod";
import { getEntitlements, isPaywallBypassed, isTrialExpired } from "~/server/billing/entitlements";
import { activePendingInvitationWhere, isInvitationActive } from "~/lib/invitation-utils";
import { activeUserWorkspaceWhere } from "~/lib/user-workspace-filters";
import {
  createOrRenewInvitation,
  getInviterDetails,
} from "~/server/invitations/invitation-service";

const bulkInviteSchema = z.object({
  invitations: z
    .array(
      z.object({
        email: z.string().email("Invalid email address"),
        role: z.enum(["OWNER_CCO", "MEMBER", "ADVISOR"]),
      }),
    )
    .min(1, "At least one invitation is required")
    .max(50, "Maximum 50 invitations at once"),
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
    const { invitations } = bulkInviteSchema.parse(body);

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
            ...activeUserWorkspaceWhere,
          },
        },
      },
      select: {
        id: true,
        name: true,
        billingStatus: true,
        planTier: true,
        trialEndsAt: true,
      },
    });

    if (!workspace) {
      return new Response("Workspace not found or access denied", {
        status: 404,
      });
    }

    const inviter = await getInviterDetails(session.user.id, workspaceId);

    const results = {
      created: [] as Array<{ email: string; role: string; invitationId: string }>,
      resent: [] as Array<{ email: string; role: string; invitationId: string }>,
      skipped: [] as Array<{ email: string; reason: string }>,
    };

    let remainingSeats = Infinity;
    if (!isPaywallBypassed(workspace.billingStatus)) {
      if (workspace.billingStatus === "TRIALING" && isTrialExpired(workspace.trialEndsAt)) {
        return Response.json(
          { error: "Trial expired. Please upgrade to invite users." },
          { status: 402 },
        );
      }
      if (workspace.billingStatus !== "ACTIVE" && workspace.billingStatus !== "TRIALING") {
        return Response.json(
          { error: "Subscription inactive. Please update billing to invite users." },
          { status: 402 },
        );
      }
      const ent = getEntitlements(workspace);
      const memberCount = await db.userWorkspace.count({
        where: { workspaceId, ...activeUserWorkspaceWhere },
      });
      const pendingInvites = await db.invitation.count({
        where: { workspaceId, ...activePendingInvitationWhere() },
      });
      remainingSeats = ent.maxUsers - (memberCount + pendingInvites);
    }

    for (const { email, role } of invitations) {
      try {
        const existingMembership = await db.userWorkspace.findFirst({
          where: {
            workspaceId,
            user: { email },
            ...activeUserWorkspaceWhere,
          },
        });

        if (existingMembership) {
          results.skipped.push({
            email,
            reason: "User is already a member of this workspace",
          });
          continue;
        }

        const existingInvitation = await db.invitation.findUnique({
          where: { workspaceId_email: { workspaceId, email } },
        });

        const willResend =
          existingInvitation &&
          !existingInvitation.acceptedAt &&
          isInvitationActive(existingInvitation);

        if (!willResend && remainingSeats <= 0) {
          results.skipped.push({ email, reason: "User limit reached for current plan" });
          continue;
        }

        const result = await createOrRenewInvitation({
          workspaceId,
          workspaceName: workspace.name,
          email,
          role,
          invitedById: session.user.id,
          inviter,
          ipAddress,
          userAgent,
          auditAction: willResend ? "INVITE_RESENT" : "INVITE_SENT",
          auditMetadata: { bulk: true },
        });

        if (willResend && !result.renewed) {
          results.resent.push({ email, role, invitationId: result.invitationId });
        } else {
          results.created.push({ email, role, invitationId: result.invitationId });
          if (remainingSeats !== Infinity) {
            remainingSeats -= 1;
          }
        }
      } catch (error) {
        console.error(`Error processing invitation for ${email}:`, error);
        results.skipped.push({
          email,
          reason: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return Response.json(
      {
        results,
        summary: {
          total: invitations.length,
          created: results.created.length,
          resent: results.resent.length,
          skipped: results.skipped.length,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ error: error.errors }, { status: 400 });
    }
    console.error("Error creating bulk invitations:", error);
    return Response.json({ error: "Failed to create invitations" }, { status: 500 });
  }
}
