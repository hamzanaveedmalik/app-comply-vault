import { requireAppAccess } from "~/server/auth/guards";
import { db } from "~/server/db";
import { redirect } from "next/navigation";
import { IntegrationsClient } from "./integrations-client";

export default async function IntegrationsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
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
        config: true,
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
    const cfg = config?.config as { accountEmail?: string; recordingScope?: string } | null;
    return {
      id: cred.id,
      provider: cred.provider,
      status: cred.status,
      expiresAt: cred.expiresAt?.toISOString() ?? null,
      lastSyncAt: config?.lastSyncAt?.toISOString() ?? null,
      lastErrorAt: config?.lastErrorAt?.toISOString() ?? null,
      lastErrorMessage: config?.lastErrorMessage ?? null,
      connectedAt: cred.createdAt.toISOString(),
      accountEmail: cfg?.accountEmail ?? null,
      recordingScope: cfg?.recordingScope ?? "all",
    };
  });

  const zoomConnected = params.zoom_connected === "1";
  const zoomEmail = typeof params.zoom_email === "string" ? decodeURIComponent(params.zoom_email) : null;
  const zoomError = typeof params.zoom_error === "string" ? params.zoom_error : null;
  const zoomErrorDescription = typeof params.zoom_error_description === "string"
    ? decodeURIComponent(params.zoom_error_description)
    : null;

  const teamsConnected = params.teams_connected === "1";
  const teamsEmail = typeof params.teams_email === "string" ? decodeURIComponent(params.teams_email) : null;
  const teamsError = typeof params.teams_error === "string" ? params.teams_error : null;
  const teamsErrorDescription = typeof params.teams_error_description === "string"
    ? decodeURIComponent(params.teams_error_description)
    : null;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-6">Integrations</h1>
      <IntegrationsClient
        workspaceId={access.workspaceId}
        initialIntegrations={integrations}
        zoomConnected={zoomConnected}
        zoomEmail={zoomEmail}
        zoomError={zoomError}
        zoomErrorDescription={zoomErrorDescription}
        teamsConnected={teamsConnected}
        teamsEmail={teamsEmail}
        teamsError={teamsError}
        teamsErrorDescription={teamsErrorDescription}
      />
    </div>
  );
}
