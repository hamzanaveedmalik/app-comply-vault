import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { z } from "zod";

const setupBillingSchema = z.object({
  workspaceId: z.string(),
});

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return new Response("Unauthorized", { status: 401 });
    }

    // Only OWNER_CCO can set up billing
    if (session.user.role !== "OWNER_CCO") {
      return new Response("Forbidden: Only workspace owners can set up billing", {
        status: 403,
      });
    }

    const body = await request.json();
    const { workspaceId } = setupBillingSchema.parse(body);

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

    // Check if billing is already set up
    if (workspace.billingStatus !== "PILOT" || workspace.pilotStartDate) {
      return Response.json(
        { error: "Billing is already set up for this workspace" },
        { status: 400 }
      );
    }

    // Update workspace billing status
    const updated = await db.workspace.update({
      where: { id: workspaceId },
      data: {
        billingStatus: "PILOT",
        pilotStartDate: new Date(),
      },
    });

    // Log billing setup
    await db.auditEvent.create({
      data: {
        workspaceId,
        userId: session.user.id,
        action: "UPLOAD", // Placeholder - billing action can be added later
        resourceType: "workspace",
        resourceId: workspaceId,
        metadata: {
          action: "billing_setup",
        },
      },
    });

    return Response.json({
      workspace: {
        id: updated.id,
        billingStatus: updated.billingStatus,
        pilotStartDate: updated.pilotStartDate,
      },
      message: "Billing setup completed.",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ error: error.errors }, { status: 400 });
    }
    console.error("Error setting up billing:", error);
    return Response.json(
      { error: "Failed to set up billing" },
      { status: 500 }
    );
  }
}


