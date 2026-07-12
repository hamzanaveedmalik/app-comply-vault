import { requireAppAccess } from "~/server/auth/guards";
import { listCommunicationThreads } from "~/server/mailbox/threads";

export async function GET(): Promise<Response> {
  const access = await requireAppAccess();
  if (!access.ok) {
    return Response.json({ success: false, error: access.error }, { status: access.status });
  }
  const data = await listCommunicationThreads(access.workspaceId);
  return Response.json({ success: true, data });
}
