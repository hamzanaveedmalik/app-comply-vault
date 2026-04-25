/**
 * POST — re-queue SharePoint deposit (e.g. after fixing integration errors). Owner only.
 */

import { requireAppAccess } from "~/server/auth/guards";
import { db } from "~/server/db";
import { publishSharePointDepositJob } from "~/server/qstash";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const access = await requireAppAccess();
  if (!access.ok) {
    return Response.json({ error: access.error }, { status: access.status });
  }
  if (access.session.user.role !== "OWNER_CCO") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: meetingId } = await params;
  const meeting = await db.meeting.findFirst({
    where: { id: meetingId, workspaceId: access.workspaceId },
  });
  if (!meeting) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  if (meeting.status !== "FINALIZED") {
    return Response.json({ error: "Meeting must be finalized" }, { status: 400 });
  }

  const cred = await db.integrationCredential.findUnique({
    where: { workspaceId_provider: { workspaceId: access.workspaceId, provider: "SHAREPOINT" } },
  });
  if (!cred || cred.status !== "CONNECTED") {
    return Response.json({ error: "SharePoint not connected" }, { status: 400 });
  }

  if (meeting.sharepointDepositedAt) {
    return Response.json(
      { error: "Already deposited; remove filing first if a new upload is required" },
      { status: 400 }
    );
  }

  const messageId = await publishSharePointDepositJob({
    meetingId,
    workspaceId: access.workspaceId,
  });
  if (!messageId) {
    return Response.json(
      { success: false, error: "Job queue not available (check QStash and NEXT_PUBLIC_APP_URL)" },
      { status: 503 }
    );
  }
  return Response.json({ success: true, messageId });
}
