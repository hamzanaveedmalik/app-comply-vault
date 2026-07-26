import { auth } from "~/server/auth";
import { replayParkedIngest } from "~/server/retention/parked-ingest";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ workspaceId: string; parkedIngestId: string }> },
): Promise<Response> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { workspaceId, parkedIngestId } = await params;
    if (session.user.workspaceId !== workspaceId) {
      return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const result = await replayParkedIngest({
      workspaceId,
      parkedIngestId,
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
    console.error("Error replaying parked ingest:", error);
    return Response.json(
      { success: false, error: "Failed to replay parked recording" },
      { status: 500 },
    );
  }
}
