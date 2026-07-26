import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { z } from "zod";
import { updateWorkspaceRetentionPolicy } from "~/server/retention/update-policy";

const updateSettingsSchema = z.object({
  retentionYears: z.number().int().min(5).max(25).optional(),
  fiscalYearEndMonth: z.number().int().min(1).max(12).optional(),
  fiscalTimezone: z.string().min(3).max(64).optional(),
  legalHold: z.boolean().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ workspaceId: string }> },
): Promise<Response> {
  try {
    const session = await auth();
    if (!session?.user) {
      return new Response("Unauthorized", { status: 401 });
    }

    const { workspaceId } = await params;

    if (session.user.role !== "OWNER_CCO") {
      return new Response("Forbidden: Only workspace owners can update settings", {
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

    const body = await request.json();
    const input = updateSettingsSchema.parse(body);

    const result = await updateWorkspaceRetentionPolicy({
      workspaceId,
      userId: session.user.id,
      input,
    });

    if (!result.success) {
      return Response.json({ success: false, error: result.error }, { status: 400 });
    }

    return Response.json({
      success: true,
      workspace: {
        id: workspaceId,
        ...result.data,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ success: false, error: error.errors }, { status: 400 });
    }
    console.error("Error updating workspace settings:", error);
    return Response.json(
      { success: false, error: "Failed to update settings" },
      { status: 500 },
    );
  }
}
