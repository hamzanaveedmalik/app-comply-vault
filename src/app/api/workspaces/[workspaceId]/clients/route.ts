import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { activeUserWorkspaceWhere } from "~/lib/user-workspace-filters";
import { listClientsForWorkspace } from "~/server/clients/queries";

export async function GET(
  _request: Request,
  context: { params: Promise<{ workspaceId: string }> },
): Promise<Response> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { workspaceId } = await context.params;

    const membership = await db.userWorkspace.findFirst({
      where: { userId: session.user.id, workspaceId, ...activeUserWorkspaceWhere },
    });

    if (!membership) {
      return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const data = await listClientsForWorkspace(workspaceId);
    return Response.json({ success: true, data });
  } catch (e) {
    console.error("GET /api/workspaces/[workspaceId]/clients:", e);
    return Response.json(
      { success: false, error: "Failed to load clients" },
      { status: 500 },
    );
  }
}
