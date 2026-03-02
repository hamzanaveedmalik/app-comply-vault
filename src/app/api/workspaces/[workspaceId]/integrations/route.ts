/**
 * GET /api/workspaces/[workspaceId]/integrations
 * Epic 6 Story 6.4: Integration Health Dashboard — list connected integrations
 */

import { requireAppAccess } from "~/server/auth/guards";
import { db } from "~/server/db";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  const access = await requireAppAccess();
  if (!access.ok) {
    return new Response(access.error, { status: access.status });
  }

  const { workspaceId } = await params;
  if (workspaceId !== access.workspaceId) {
    return new Response("Forbidden", { status: 403 });
  }

  // Only OWNER_CCO can manage integrations
  if (access.session.user.role !== "OWNER_CCO") {
    return new Response("Forbidden: Only workspace owners can view integrations", {
      status: 403,
    });
  }

  const [credentials, configs] = await Promise.all([
    db.integrationCredential.findMany({
      where: { workspaceId },
      select: {
        id: true,
        provider: true,
        status: true,
        expiresAt: true,
        createdAt: true,
      },
    }),
    db.integrationConfig.findMany({
      where: { workspaceId },
      select: {
        id: true,
        provider: true,
        lastSyncAt: true,
        lastErrorAt: true,
        lastErrorMessage: true,
      },
    }),
  ]);

  const configByProvider = Object.fromEntries(
    configs.map((c) => [c.provider, c])
  );

  const integrations = credentials.map((cred) => {
    const config = configByProvider[cred.provider];
    return {
      id: cred.id,
      provider: cred.provider,
      status: cred.status,
      expiresAt: cred.expiresAt?.toISOString() ?? null,
      lastSyncAt: config?.lastSyncAt?.toISOString() ?? null,
      lastErrorAt: config?.lastErrorAt?.toISOString() ?? null,
      lastErrorMessage: config?.lastErrorMessage ?? null,
      connectedAt: cred.createdAt.toISOString(),
    };
  });

  return Response.json({ integrations });
}
