import { requireAppAccess } from "~/server/auth/guards";
import { z } from "zod";
import { supersedeMeeting } from "~/server/meetings/supersede";

export const runtime = "nodejs";

const bodySchema = z.object({
  reason: z.string().min(10, "A narrative reason is required"),
});

/**
 * POST /api/meetings/[id]/supersede — CV-TR-16 OWNER_CCO only.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const access = await requireAppAccess();
    if (!access.ok) {
      return Response.json(
        { success: false, error: access.error },
        { status: access.status },
      );
    }
    const { session, workspaceId } = access;

    if (session.user.role !== "OWNER_CCO") {
      return Response.json(
        {
          success: false,
          error: "Only workspace owners (CCO) can supersede sealed records",
        },
        { status: 403 },
      );
    }

    const { id } = await params;
    const body = bodySchema.parse(await request.json());

    const result = await supersedeMeeting({
      meetingId: id,
      workspaceId,
      actorUserId: session.user.id,
      reason: body.reason,
    });

    if (!result.success) {
      return Response.json(
        { success: false, error: result.error },
        { status: result.status },
      );
    }

    return Response.json({ success: true, data: result.data });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json(
        { success: false, error: "Invalid request body", details: error.errors },
        { status: 400 },
      );
    }
    console.error("supersede route:", error);
    return Response.json(
      { success: false, error: "Failed to supersede meeting" },
      { status: 500 },
    );
  }
}
