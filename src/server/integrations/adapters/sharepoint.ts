/**
 * Microsoft SharePoint / OneDrive — Epic 2 Stories 2.1–2.2
 * Reuses the same Azure AD app as Teams; app registration must include delegated
 * `Files.ReadWrite.All` and `Sites.ReadWrite.All` (+ admin consent).
 */

import { db } from "~/server/db";
import { encryptToken } from "../crypto";
import { BaseIntegrationAdapter } from "../base-adapter";
import type { ConnectResult, OAuthTokens } from "../types";
import { IntegrationProvider } from "../../../../generated/prisma";

const AZURE_AUTH_BASE = "https://login.microsoftonline.com";
const GRAPH_BASE = "https://graph.microsoft.com/v1.0";
const SCOPES = [
  "Files.ReadWrite.All",
  "Sites.ReadWrite.All",
  "User.Read",
  "offline_access",
].join(" ");

function getAzureConfig() {
  const clientId = process.env.TEAMS_CLIENT_ID;
  const clientSecret = process.env.TEAMS_CLIENT_SECRET;
  const tenantId = process.env.TEAMS_TENANT_ID ?? "common";
  if (!clientId || !clientSecret) {
    throw new Error("TEAMS_CLIENT_ID and TEAMS_CLIENT_SECRET must be set for SharePoint");
  }
  return { clientId, clientSecret, tenantId };
}

function getAppBaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_APP_URL ?? process.env.AUTH_URL;
  if (!url) {
    throw new Error("NEXT_PUBLIC_APP_URL or AUTH_URL must be set for SharePoint OAuth");
  }
  return url.replace(/\/$/, "");
}

export function getSharePointAuthorizeUrl(state: string): string {
  const { clientId, tenantId } = getAzureConfig();
  const redirectUri = `${getAppBaseUrl()}/api/integrations/sharepoint/callback`;
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: redirectUri,
    scope: SCOPES,
    state,
    response_mode: "query",
  });
  return `${AZURE_AUTH_BASE}/${tenantId}/oauth2/v2.0/authorize?${params.toString()}`;
}

async function exchangeCodeForTokens(code: string, redirectUri: string): Promise<OAuthTokens> {
  const { clientId, clientSecret, tenantId } = getAzureConfig();
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  }).toString();

  const res = await fetch(`${AZURE_AUTH_BASE}/${tenantId}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`SharePoint token exchange failed: ${res.status} ${err}`);
  }

  const data = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
  };

  const expiresAt = data.expires_in
    ? new Date(Date.now() + data.expires_in * 1000)
    : undefined;

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt,
    scopes: SCOPES,
  };
}

async function getGraphUserEmail(accessToken: string): Promise<string> {
  const res = await fetch(`${GRAPH_BASE}/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return "SharePoint";
  const data = (await res.json()) as { mail?: string; userPrincipalName?: string };
  return data.mail ?? data.userPrincipalName ?? "SharePoint";
}

async function getDefaultDriveId(
  accessToken: string
): Promise<{ id: string; name: string }> {
  const res = await fetch(`${GRAPH_BASE}/me/drive`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Could not read default drive: ${res.status} ${t}`);
  }
  const data = (await res.json()) as { id: string; name: string };
  if (!data.id) {
    throw new Error("Graph /me/drive response missing id");
  }
  return { id: data.id, name: data.name };
}

const DEFAULT_ROOT = "ComplyVault";

export const sharepointAdapter = new (class extends BaseIntegrationAdapter {
  readonly provider: IntegrationProvider = "SHAREPOINT";

  async connect(params: {
    workspaceId: string;
    userId: string;
    authCode?: string;
    redirectUri?: string;
  }): Promise<ConnectResult> {
    if (!params.authCode || !params.redirectUri) {
      return {
        success: false,
        error: "authCode and redirectUri required to complete SharePoint OAuth",
      };
    }

    const tokens = await exchangeCodeForTokens(params.authCode, params.redirectUri);
    const accountEmail = await getGraphUserEmail(tokens.accessToken);
    const { id: driveId, name: driveName } = await getDefaultDriveId(tokens.accessToken);

    const credential = await db.integrationCredential.upsert({
      where: {
        workspaceId_provider: {
          workspaceId: params.workspaceId,
          provider: "SHAREPOINT",
        },
      },
      create: {
        workspaceId: params.workspaceId,
        provider: "SHAREPOINT",
        accessTokenEncrypted: encryptToken(tokens.accessToken),
        refreshTokenEncrypted: tokens.refreshToken
          ? encryptToken(tokens.refreshToken)
          : null,
        expiresAt: tokens.expiresAt ?? null,
        scopes: tokens.scopes ?? null,
        status: "CONNECTED",
      },
      update: {
        accessTokenEncrypted: encryptToken(tokens.accessToken),
        refreshTokenEncrypted: tokens.refreshToken
          ? encryptToken(tokens.refreshToken)
          : null,
        expiresAt: tokens.expiresAt ?? null,
        scopes: tokens.scopes ?? null,
        status: "CONNECTED",
      },
    });

    const existing = await db.integrationConfig.findUnique({
      where: {
        workspaceId_provider: {
          workspaceId: params.workspaceId,
          provider: "SHAREPOINT",
        },
      },
      select: { config: true },
    });
    const existingConfig = (existing?.config as Record<string, unknown>) ?? {};

    await db.integrationConfig.upsert({
      where: {
        workspaceId_provider: {
          workspaceId: params.workspaceId,
          provider: "SHAREPOINT",
        },
      },
      create: {
        workspaceId: params.workspaceId,
        provider: "SHAREPOINT",
        config: {
          accountEmail,
          driveId,
          driveName,
          rootFolder: DEFAULT_ROOT,
        },
      },
      update: {
        config: {
          ...existingConfig,
          accountEmail,
          driveId,
          driveName,
          rootFolder:
            (existingConfig.rootFolder as string | undefined) ?? DEFAULT_ROOT,
        },
        lastErrorAt: null,
        lastErrorMessage: null,
      },
    });

    return {
      success: true,
      credentialId: credential.id,
      accountDisplayName: accountEmail,
    };
  }

  async sync(): Promise<never> {
    throw new Error("SharePoint adapter has no pull sync — use deposit job on finalize");
  }

  async disconnect(params: { workspaceId: string }): Promise<{ success: boolean; error?: string }> {
    const credential = await db.integrationCredential.findUnique({
      where: {
        workspaceId_provider: { workspaceId: params.workspaceId, provider: "SHAREPOINT" },
      },
    });
    if (!credential) return { success: true };

    await db.integrationCredential.delete({ where: { id: credential.id } });
    await db.integrationConfig.deleteMany({
      where: { workspaceId: params.workspaceId, provider: "SHAREPOINT" },
    });
    return { success: true };
  }

  async handleWebhook(): Promise<Record<string, unknown> | null> {
    return null;
  }
})();
