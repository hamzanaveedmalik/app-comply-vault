import { requireAppAccess } from "~/server/auth/guards";
import { db } from "~/server/db";
import { getConnectionAccessToken } from "~/server/mailbox/m365-auth";
import { listMailFolders } from "~/server/mailbox/graph-client";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
): Promise<Response> {
  const access = await requireAppAccess();
  if (!access.ok) {
    return Response.json({ success: false, error: access.error }, { status: access.status });
  }
  const { id } = await context.params;

  const connection = await db.mailboxConnection.findFirst({
    where: { id, workspaceId: access.workspaceId, deletedAt: null },
  });
  if (!connection) {
    return Response.json({ success: false, error: "Not found" }, { status: 404 });
  }

  try {
    const token = await getConnectionAccessToken({
      workspaceId: access.workspaceId,
      connectionId: connection.id,
    });
    const folders = await listMailFolders({
      accessToken: token,
      mailboxAddress: connection.mailboxAddress,
    });
    return Response.json({
      success: true,
      data: folders.map((f) => ({
        id: f.id,
        displayName: f.displayName,
        parentFolderId: f.parentFolderId ?? null,
      })),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "folder_fetch_failed";
    const hint =
      message === "M365 mail integration not connected"
        ? "Complete Admin consent (application mode) or Connect my mailbox (delegated) on /integrations/m365-mail first."
        : message;
    return Response.json({ success: false, error: hint }, { status: 502 });
  }
}
