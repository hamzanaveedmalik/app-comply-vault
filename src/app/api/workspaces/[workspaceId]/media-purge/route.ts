import { auth } from "~/server/auth";
import { z } from "zod";
import { purgeRetainedMedia } from "~/server/retention/purge-retained-media";

// Explicit confirmation required — this deletes media irreversibly.
const bodySchema = z.object({
  confirm: z.literal("PURGE"),
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

    bodySchema.parse(await request.json());

    const result = await purgeRetainedMedia({
      workspaceId,
      userId: session.user.id,
      actorRole: session.user.role,
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
        { success: false, error: "Purge requires explicit confirmation" },
        { status: 400 },
      );
    }
    console.error("Error purging retained media:", error);
    return Response.json(
      { success: false, error: "Failed to purge retained media" },
      { status: 500 },
    );
  }
}
