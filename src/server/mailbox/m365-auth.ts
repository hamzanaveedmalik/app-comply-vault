/**
 * M365 Mail OAuth — admin (application) and delegated consent flows.
 * Epic B CV-B-01
 */

import { db } from "~/server/db";
import { encryptToken, decryptToken } from "~/server/integrations/crypto";
import { IntegrationProvider, IntegrationStatus } from "../../../generated/prisma";

const AZURE_AUTH_BASE = "https://login.microsoftonline.com";
const GRAPH_BASE = "https://graph.microsoft.com/v1.0";

const DELEGATED_SCOPES = ["Mail.Read", "User.Read", "offline_access"].join(" ");
const APPLICATION_SCOPES = ["https://graph.microsoft.com/.default"].join(" ");

export type M365MailConfig = {
  clientId: string;
  clientSecret: string;
  tenantId: string;
};

export function getM365MailConfig(): M365MailConfig {
  const clientId =
    process.env.M365_MAIL_CLIENT_ID ?? process.env.TEAMS_CLIENT_ID;
  const clientSecret =
    process.env.M365_MAIL_CLIENT_SECRET ?? process.env.TEAMS_CLIENT_SECRET;
  const tenantId =
    process.env.M365_MAIL_TENANT_ID ??
    process.env.TEAMS_TENANT_ID ??
    "common";
  if (!clientId || !clientSecret) {
    throw new Error(
      "M365_MAIL_CLIENT_ID and M365_MAIL_CLIENT_SECRET (or TEAMS_* fallbacks) must be set"
    );
  }
  return { clientId, clientSecret, tenantId };
}

function getAppBaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_APP_URL ?? process.env.AUTH_URL;
  if (!url) {
    throw new Error("NEXT_PUBLIC_APP_URL or AUTH_URL must be set for M365 OAuth");
  }
  return url.replace(/\/$/, "");
}

export function getM365DelegatedAuthorizeUrl(state: string): string {
  const { clientId, tenantId } = getM365MailConfig();
  const redirectUri = `${getAppBaseUrl()}/api/integrations/m365-mail/callback`;
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: redirectUri,
    scope: DELEGATED_SCOPES,
    state,
    response_mode: "query",
    prompt: "consent",
  });
  return `${AZURE_AUTH_BASE}/${tenantId}/oauth2/v2.0/authorize?${params.toString()}`;
}

export function getM365AdminConsentUrl(state: string): string {
  const { clientId, tenantId } = getM365MailConfig();
  const redirectUri = `${getAppBaseUrl()}/api/integrations/m365-mail/admin-consent/callback`;
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    state,
  });
  return `${AZURE_AUTH_BASE}/${tenantId}/v2.0/adminconsent?${params.toString()}`;
}

async function exchangeCodeForTokens(
  code: string,
  redirectUri: string,
  scopes: string
): Promise<{
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
}> {
  const { clientId, clientSecret, tenantId } = getM365MailConfig();
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
    scope: scopes,
  }).toString();

  const res = await fetch(`${AZURE_AUTH_BASE}/${tenantId}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`M365 token exchange failed: ${res.status}`);
  }

  const data = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
  };

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: data.expires_in
      ? new Date(Date.now() + data.expires_in * 1000)
      : undefined,
  };
}

export async function exchangeDelegatedCode(
  code: string
): Promise<{
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  email: string;
}> {
  const redirectUri = `${getAppBaseUrl()}/api/integrations/m365-mail/callback`;
  const tokens = await exchangeCodeForTokens(code, redirectUri, DELEGATED_SCOPES);
  const email = await getGraphUserEmail(tokens.accessToken);
  return { ...tokens, email };
}

export async function acquireApplicationToken(
  tenantId: string
): Promise<{ accessToken: string; expiresAt?: Date }> {
  const { clientId, clientSecret } = getM365MailConfig();
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    scope: APPLICATION_SCOPES,
    grant_type: "client_credentials",
  }).toString();

  const res = await fetch(
    `${AZURE_AUTH_BASE}/${tenantId}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    }
  );

  if (!res.ok) {
    throw new Error(`M365 application token failed: ${res.status}`);
  }

  const data = (await res.json()) as {
    access_token: string;
    expires_in?: number;
  };

  return {
    accessToken: data.access_token,
    expiresAt: data.expires_in
      ? new Date(Date.now() + data.expires_in * 1000)
      : undefined,
  };
}

export async function getGraphUserEmail(accessToken: string): Promise<string> {
  const res = await fetch(`${GRAPH_BASE}/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return "mailbox";
  const data = (await res.json()) as { mail?: string; userPrincipalName?: string };
  return (data.mail ?? data.userPrincipalName ?? "mailbox").toLowerCase();
}

export async function storeWorkspaceM365Credential(args: {
  workspaceId: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  scopes: string;
  tenantId?: string;
}): Promise<void> {
  const { workspaceId, accessToken, refreshToken, expiresAt, scopes, tenantId } =
    args;

  await db.integrationCredential.upsert({
    where: {
      workspaceId_provider: {
        workspaceId,
        provider: IntegrationProvider.M365_MAIL,
      },
    },
    create: {
      workspaceId,
      provider: IntegrationProvider.M365_MAIL,
      accessTokenEncrypted: encryptToken(accessToken),
      refreshTokenEncrypted: refreshToken
        ? encryptToken(refreshToken)
        : null,
      expiresAt,
      scopes,
      status: IntegrationStatus.CONNECTED,
    },
    update: {
      accessTokenEncrypted: encryptToken(accessToken),
      refreshTokenEncrypted: refreshToken
        ? encryptToken(refreshToken)
        : undefined,
      expiresAt,
      scopes,
      status: IntegrationStatus.CONNECTED,
    },
  });

  await db.integrationConfig.upsert({
    where: {
      workspaceId_provider: {
        workspaceId,
        provider: IntegrationProvider.M365_MAIL,
      },
    },
    create: {
      workspaceId,
      provider: IntegrationProvider.M365_MAIL,
      config: { tenantId: tenantId ?? null, consentMode: "APPLICATION" },
    },
    update: {
      config: { tenantId: tenantId ?? null, consentMode: "APPLICATION" },
      lastErrorAt: null,
      lastErrorMessage: null,
    },
  });
}

export async function getWorkspaceM365AccessToken(
  workspaceId: string
): Promise<string | null> {
  const cred = await db.integrationCredential.findUnique({
    where: {
      workspaceId_provider: {
        workspaceId,
        provider: IntegrationProvider.M365_MAIL,
      },
    },
  });
  if (!cred || cred.status !== IntegrationStatus.CONNECTED) return null;
  return decryptToken(cred.accessTokenEncrypted);
}

export async function getConnectionAccessToken(args: {
  workspaceId: string;
  connectionId: string;
}): Promise<string> {
  const connection = await db.mailboxConnection.findFirst({
    where: {
      id: args.connectionId,
      workspaceId: args.workspaceId,
      deletedAt: null,
    },
  });
  if (!connection) {
    throw new Error("Mailbox connection not found");
  }

  if (connection.consentMode === "DELEGATED" && connection.encryptedToken) {
    return decryptToken(connection.encryptedToken);
  }

  const token = await getWorkspaceM365AccessToken(args.workspaceId);
  if (!token) {
    throw new Error("M365 mail integration not connected");
  }
  return token;
}

export { GRAPH_BASE, DELEGATED_SCOPES };
