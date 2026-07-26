import { auth } from "~/server/auth";
import { z } from "zod";
import { setMediaPosture } from "~/server/retention/media-posture";

const bodySchema = z.object({
  posture: z.enum(["RETAIN", "DISCARD"]),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ workspaceId: string }> },
): Promise<Response> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { workspaceId } = await params;
    if (session.user.workspaceId !== workspaceId) {
      return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const { posture } = bodySchema.parse(await request.json());

    const result = await setMediaPosture({
      workspaceId,
      userId: session.user.id,
      actorRole: session.user.role,
      posture,
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
      return Response.json({ success: false, error: error.errors }, { status: 400 });
    }
    console.error("Error setting media posture:", error);
    return Response.json(
      { success: false, error: "Failed to set media posture" },
      { status: 500 },
    );
  }
}
