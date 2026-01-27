import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { sendInvitationEmail } from "~/server/email";
import { z } from "zod";
import { randomBytes } from "crypto";

const bulkInviteSchema = z.object({
  invitations: z.array(
    z.object({
      email: z.string().email("Invalid email address"),
      role: z.enum(["OWNER_CCO", "MEMBER"]),
    })
  ).min(1, "At least one invitation is required").max(50, "Maximum 50 invitations at once"),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return new Response("Unauthorized", { status: 401 });
    }

    const { workspaceId } = await params;
    const body = await request.json();
    const { invitations } = bulkInviteSchema.parse(body);

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

    // Verify user has permission to invite (must be OWNER_CCO)
    if (session.user.role !== "OWNER_CCO") {
      return new Response("Forbidden: Only workspace owners can invite users", {
        status: 403,
      });
    }

    // Verify workspace exists and user belongs to it
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

    const results = {
      created: [] as Array<{ email: string; role: string; invitationId: string }>,
      resent: [] as Array<{ email: string; role: string; invitationId: string }>,
      skipped: [] as Array<{ email: string; reason: string }>,
    };

    // Process each invitation
    for (const { email, role } of invitations) {
      try {
        // Check if user is already a member
        const existingMembership = await db.userWorkspace.findFirst({
          where: {
            workspaceId,
            user: {
              email,
            },
          },
        });

        if (existingMembership) {
          results.skipped.push({
            email,
            reason: "User is already a member of this workspace",
          });
          continue;
        }

        // Check if there's a pending invitation
        const existingInvitation = await db.invitation.findUnique({
          where: {
            workspaceId_email: {
              workspaceId,
              email,
            },
          },
        });

        if (existingInvitation && !existingInvitation.acceptedAt) {
          // Resend invitation if not expired
          if (existingInvitation.expiresAt > new Date()) {
            try {
              await sendInvitationEmail({
                email,
                workspaceName: workspace.name,
                invitationToken: existingInvitation.token,
                role: existingInvitation.role,
              });
            } catch (emailError) {
              console.error("Error resending invitation email:", emailError);
            }

            // Log invitation resend
            await db.auditEvent.create({
              data: {
                workspaceId,
                userId: session.user.id,
                action: "UPLOAD",
                resourceType: "invitation",
                resourceId: existingInvitation.id,
                metadata: {
                  email,
                  role: existingInvitation.role,
                  action: "invitation_resent",
                  bulk: true,
                },
              },
            });

            results.resent.push({
              email,
              role: existingInvitation.role,
              invitationId: existingInvitation.id,
            });
            continue;
          }
        }

        // Create new invitation
        const token = randomBytes(32).toString("hex");
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiration

        const invitation = await db.invitation.create({
          data: {
            workspaceId,
            email,
            role,
            token,
            invitedBy: session.user.id,
            expiresAt,
          },
        });

        // Send invitation email
        try {
          await sendInvitationEmail({
            email,
            workspaceName: workspace.name,
            invitationToken: token,
            role,
          });
        } catch (emailError) {
          console.error("Error sending invitation email:", emailError);
        }

        // Log invitation creation
        await db.auditEvent.create({
          data: {
            workspaceId,
            userId: session.user.id,
            action: "UPLOAD",
            resourceType: "invitation",
            resourceId: invitation.id,
            metadata: {
              email,
              role,
              action: "invitation_created",
              bulk: true,
            },
          },
        });

        results.created.push({
          email,
          role,
          invitationId: invitation.id,
        });
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
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ error: error.errors }, { status: 400 });
    }
    console.error("Error creating bulk invitations:", error);
    return Response.json(
      { error: "Failed to create invitations" },
      { status: 500 }
    );
  }
}

