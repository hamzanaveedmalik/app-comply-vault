/**
 * GET /api/workspaces/[workspaceId]/integrations/[credentialId]/failures
 * Epic 6 Story 6.4: Last 10 failures per integration
 */

import { requireAppAccess } from "~/server/auth/guards";
import { db } from "~/server/db";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ workspaceId: string; credentialId: string }> }
) {
  const access = await requireAppAccess();
  if (!access.ok) {
    return new Response(access.error, { status: access.status });
  }

  const { workspaceId, credentialId } = await params;
  if (workspaceId !== access.workspaceId) {
    return new Response("Forbidden", { status: 403 });
  }

  const credential = await db.integrationCredential.findFirst({
    where: { id: credentialId, workspaceId },
    select: { provider: true },
  });

  if (!credential) {
    return new Response("Integration not found", { status: 404 });
  }

  const config = await db.integrationConfig.findFirst({
    where: { workspaceId, provider: credential.provider },
  });

  const failures = await db.integrationSyncLog.findMany({
    where: {
      provider: credential.provider,
      status: "failed",
      OR: [
        { integrationConfig: { workspaceId } },
        { meeting: { workspaceId } },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: {
      id: true,
      meetingId: true,
      action: true,
      errorMessage: true,
      attempts: true,
      createdAt: true,
    },
  });

  return Response.json({
    failures: failures.map((f) => ({
      id: f.id,
      meetingId: f.meetingId,
      action: f.action,
      errorMessage: f.errorMessage,
      attempts: f.attempts,
      createdAt: f.createdAt.toISOString(),
    })),
  });
}
