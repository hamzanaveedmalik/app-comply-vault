/**
 * Gmail OAuth — delegated (per-mailbox) consent flow.
 *
 * Mirrors m365-auth.ts but for Google. Gmail access tokens live ~1h, so
 * per-connection tokens are stored as an encrypted JSON bundle
 * ({accessToken, refreshToken, expiresAt}) on MailboxConnection.encryptedToken
 * and refreshed on demand in getConnectionAccessToken.
 */

import { db } from "~/server/db";
import { encryptToken, decryptToken } from "~/server/integrations/crypto";
import { IntegrationProvider, IntegrationStatus } from "../../../generated/prisma";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";

const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "openid",
  "email",
].join(" ");

// Refresh a per-connection token if it expires within this window.
const REFRESH_BUFFER_MS = 60 * 1000;

export type GmailMailConfig = {
  clientId: string;
  clientSecret: string;
};

export type GmailTokenBundle = {
  accessToken: string;
  refreshToken?: string | null;
  expiresAt?: string | null;
};

export function getGmailMailConfig(): GmailMailConfig {
  const clientId = process.env.GMAIL_MAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_MAIL_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error(
      "GMAIL_MAIL_CLIENT_ID and GMAIL_MAIL_CLIENT_SECRET must be set"
    );
  }
  return { clientId, clientSecret };
}

function getAppBaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_APP_URL ?? process.env.AUTH_URL;
  if (!url) {
    throw new Error("NEXT_PUBLIC_APP_URL or AUTH_URL must be set for Gmail OAuth");
  }
  return url.replace(/\/$/, "");
}

function getRedirectUri(): string {
  return `${getAppBaseUrl()}/api/integrations/gmail-mail/callback`;
}

export function getGmailAuthorizeUrl(state: string): string {
  const { clientId } = getGmailMailConfig();
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: getRedirectUri(),
    scope: GMAIL_SCOPES,
    state,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

export async function exchangeGmailCode(code: string): Promise<{
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  email: string;
}> {
  const { clientId, clientSecret } = getGmailMailConfig();
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: getRedirectUri(),
    grant_type: "authorization_code",
  }).toString();

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    throw new Error(`Gmail token exchange failed: ${res.status}`);
  }

  const data = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
  };

  const email = await getGmailUserEmail(data.access_token);

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: data.expires_in
      ? new Date(Date.now() + data.expires_in * 1000)
      : undefined,
    email,
  };
}

export async function refreshGmailToken(refreshToken: string): Promise<{
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
} | null> {
  const { clientId, clientSecret } = getGmailMailConfig();
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  }).toString();

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) return null;

  const data = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
  };

  return {
    accessToken: data.access_token,
    // Google usually omits refresh_token on refresh; keep the caller's existing one.
    refreshToken: data.refresh_token,
    expiresAt: data.expires_in
      ? new Date(Date.now() + data.expires_in * 1000)
      : undefined,
  };
}

export async function getGmailUserEmail(accessToken: string): Promise<string> {
  const res = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return "mailbox";
  const data = (await res.json()) as { email?: string };
  return (data.email ?? "mailbox").toLowerCase();
}

export function encodeConnectionToken(bundle: GmailTokenBundle): string {
  return encryptToken(JSON.stringify(bundle));
}

function decodeConnectionToken(ciphertext: string): GmailTokenBundle {
  // Backward/forward tolerant: value is always an encrypted JSON bundle.
  const raw = decryptToken(ciphertext);
  const parsed = JSON.parse(raw) as GmailTokenBundle;
  return parsed;
}

/**
 * Stores a workspace-level GMAIL_MAIL credential (for status display and the
 * token-refresh cron) plus an IntegrationConfig marking delegated consent.
 */
export async function storeWorkspaceGmailCredential(args: {
  workspaceId: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  scopes: string;
}): Promise<void> {
  const { workspaceId, accessToken, refreshToken, expiresAt, scopes } = args;

  await db.integrationCredential.upsert({
    where: {
      workspaceId_provider: {
        workspaceId,
        provider: IntegrationProvider.GMAIL_MAIL,
      },
    },
    create: {
      workspaceId,
      provider: IntegrationProvider.GMAIL_MAIL,
      accessTokenEncrypted: encryptToken(accessToken),
      refreshTokenEncrypted: refreshToken ? encryptToken(refreshToken) : null,
      expiresAt,
      scopes,
      status: IntegrationStatus.CONNECTED,
    },
    update: {
      accessTokenEncrypted: encryptToken(accessToken),
      refreshTokenEncrypted: refreshToken ? encryptToken(refreshToken) : undefined,
      expiresAt,
      scopes,
      status: IntegrationStatus.CONNECTED,
    },
  });

  await db.integrationConfig.upsert({
    where: {
      workspaceId_provider: {
        workspaceId,
        provider: IntegrationProvider.GMAIL_MAIL,
      },
    },
    create: {
      workspaceId,
      provider: IntegrationProvider.GMAIL_MAIL,
      config: { consentMode: "DELEGATED" },
    },
    update: {
      config: { consentMode: "DELEGATED" },
      lastErrorAt: null,
      lastErrorMessage: null,
    },
  });
}

/**
 * Resolves a valid Gmail access token for a connection, refreshing on demand
 * (Gmail tokens live ~1h) and persisting the re-encrypted bundle.
 */
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
  if (!connection || !connection.encryptedToken) {
    throw new Error("Gmail mail integration not connected");
  }

  const bundle = decodeConnectionToken(connection.encryptedToken);

  const expiresAtMs = bundle.expiresAt
    ? new Date(bundle.expiresAt).getTime()
    : 0;
  const needsRefresh =
    !expiresAtMs || expiresAtMs - Date.now() < REFRESH_BUFFER_MS;

  if (!needsRefresh) {
    return bundle.accessToken;
  }

  if (!bundle.refreshToken) {
    // No refresh token: return the (possibly stale) access token and let the
    // caller surface a re-auth error if the API rejects it.
    return bundle.accessToken;
  }

  const refreshed = await refreshGmailToken(bundle.refreshToken);
  if (!refreshed) {
    throw new Error("Gmail token refresh failed — reconnect the mailbox");
  }

  const newBundle: GmailTokenBundle = {
    accessToken: refreshed.accessToken,
    refreshToken: refreshed.refreshToken ?? bundle.refreshToken,
    expiresAt: refreshed.expiresAt?.toISOString() ?? null,
  };

  await db.mailboxConnection.update({
    where: { id: connection.id },
    data: { encryptedToken: encodeConnectionToken(newBundle) },
  });

  return newBundle.accessToken;
}

export { GMAIL_SCOPES };
