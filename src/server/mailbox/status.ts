import { db } from "~/server/db";
import { IntegrationProvider } from "../../../generated/prisma";
import type {
  M365WorkspaceStatus,
  GmailWorkspaceStatus,
} from "~/lib/types/evidence";

export function isM365OAuthConfigured(): boolean {
  const clientId =
    process.env.M365_MAIL_CLIENT_ID ?? process.env.TEAMS_CLIENT_ID;
  const clientSecret =
    process.env.M365_MAIL_CLIENT_SECRET ?? process.env.TEAMS_CLIENT_SECRET;
  return Boolean(clientId && clientSecret);
}

export function isGmailOAuthConfigured(): boolean {
  return Boolean(
    process.env.GMAIL_MAIL_CLIENT_ID && process.env.GMAIL_MAIL_CLIENT_SECRET
  );
}

export async function getWorkspaceGmailStatus(
  workspaceId: string
): Promise<GmailWorkspaceStatus> {
  const cred = await db.integrationCredential.findUnique({
    where: {
      workspaceId_provider: {
        workspaceId,
        provider: IntegrationProvider.GMAIL_MAIL,
      },
    },
    select: { status: true, expiresAt: true },
  });

  return {
    connected: cred?.status === "CONNECTED",
    expiresAt: cred?.expiresAt?.toISOString() ?? null,
    oauthConfigured: isGmailOAuthConfigured(),
  };
}

export async function getWorkspaceM365Status(
  workspaceId: string
): Promise<M365WorkspaceStatus> {
  const [cred, config] = await Promise.all([
    db.integrationCredential.findUnique({
      where: {
        workspaceId_provider: {
          workspaceId,
          provider: IntegrationProvider.M365_MAIL,
        },
      },
      select: { status: true, expiresAt: true },
    }),
    db.integrationConfig.findUnique({
      where: {
        workspaceId_provider: {
          workspaceId,
          provider: IntegrationProvider.M365_MAIL,
        },
      },
      select: { config: true },
    }),
  ]);

  const cfg = (config?.config as { consentMode?: string; tenantId?: string }) ?? {};

  return {
    connected: cred?.status === "CONNECTED",
    consentMode:
      cfg.consentMode === "APPLICATION" || cfg.consentMode === "DELEGATED"
        ? cfg.consentMode
        : null,
    tenantId: cfg.tenantId ?? null,
    expiresAt: cred?.expiresAt?.toISOString() ?? null,
    oauthConfigured: isM365OAuthConfigured(),
  };
}
