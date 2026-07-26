import { auth } from "~/server/auth";
import { dismissRetentionAnchoringNotice } from "~/server/retention/anchoring-notice";

export async function POST(
  _request: Request,
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

    const result = await dismissRetentionAnchoringNotice({
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

    return Response.json({ success: true });
  } catch (error) {
    console.error("Error dismissing retention notice:", error);
    return Response.json(
      { success: false, error: "Failed to dismiss notice" },
      { status: 500 },
    );
  }
}
