import { requireAppAccess } from "~/server/auth/guards";
import { listClientsForWorkspace } from "~/server/clients/queries";

export async function GET(): Promise<Response> {
  const access = await requireAppAccess();
  if (!access.ok) {
    return Response.json({ success: false, error: access.error }, { status: access.status });
  }

  const data = await listClientsForWorkspace(access.workspaceId);
  return Response.json({ success: true, data });
}
