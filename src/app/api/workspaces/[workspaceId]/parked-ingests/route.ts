import { auth } from "~/server/auth";
import { listParkedIngests } from "~/server/retention/parked-ingest";

export async function GET(
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

    const parked = await listParkedIngests(workspaceId);
    return Response.json({ success: true, data: parked });
  } catch (error) {
    console.error("Error listing parked ingests:", error);
    return Response.json(
      { success: false, error: "Failed to list parked recordings" },
      { status: 500 },
    );
  }
}
