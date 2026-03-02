/**
 * POST /api/meetings/[id]/integration-sync/retry
 * Epic 6 Story 6.7: Manual retry for failed integration writes
 */

import { requireAppAccess } from "~/server/auth/guards";
import { db } from "~/server/db";
import { enqueueIntegrationWrite } from "~/server/integrations/queue";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const access = await requireAppAccess();
  if (!access.ok) {
    return new Response(access.error, { status: access.status });
  }

  const { id: meetingId } = await params;

  const meeting = await db.meeting.findFirst({
    where: { id: meetingId, workspaceId: access.workspaceId },
  });

  if (!meeting) {
    return new Response("Meeting not found", { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const { provider, action } = body as { provider?: string; action?: string };

  if (!provider || !action) {
    return new Response("provider and action required", { status: 400 });
  }

  const config = await db.integrationConfig.findFirst({
    where: { workspaceId: access.workspaceId, provider: provider as "ZOOM" },
  });

  if (!config) {
    return new Response("Integration not connected", { status: 400 });
  }

  const jobId = await enqueueIntegrationWrite({
    workspaceId: access.workspaceId,
    meetingId,
    provider,
    action,
    payload: { meetingId, clientName: meeting.clientName },
  });

  if (!jobId) {
    return new Response("Queue not available", { status: 503 });
  }

  return Response.json({ success: true, jobId });
}
