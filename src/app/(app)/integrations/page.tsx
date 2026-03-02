import { requireAppAccess } from "~/server/auth/guards";
import { db } from "~/server/db";
import { redirect } from "next/navigation";
import { IntegrationsClient } from "./integrations-client";

export default async function IntegrationsPage() {
  const access = await requireAppAccess();
  if (!access.ok) {
    if (access.status === 401) redirect("/auth/signin");
    return (
      <div className="p-6">
        <p className="text-destructive">{access.error}</p>
      </div>
    );
  }

  if (access.session.user.role !== "OWNER_CCO") {
    return (
      <div className="p-6">
        <p className="text-destructive">Only workspace owners can manage integrations.</p>
      </div>
    );
  }

  const [credentials, configs] = await Promise.all([
    db.integrationCredential.findMany({
      where: { workspaceId: access.workspaceId },
      select: {
        id: true,
        provider: true,
        status: true,
        expiresAt: true,
        createdAt: true,
      },
    }),
    db.integrationConfig.findMany({
      where: { workspaceId: access.workspaceId },
      select: {
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

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-6">Integrations</h1>
      <IntegrationsClient
        workspaceId={access.workspaceId}
        initialIntegrations={integrations}
      />
    </div>
  );
}
