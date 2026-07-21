/**
 * OAuth token refresh — Epic 6 Story 6.2
 * Runs every 15 mins; on refresh failure, updates status to ERROR and notifies CCO
 */

import { db } from "~/server/db";
import { decryptToken, encryptToken } from "./crypto";
import { sendIntegrationReconnectEmail } from "~/server/email";
import { activeUserWorkspaceWhere } from "~/lib/user-workspace-filters";
import type { IntegrationProvider } from "../../../generated/prisma";
import { exchangeZohoRefreshToken } from "./zoho/crm-token";
import { refreshGmailToken } from "~/server/mailbox/gmail-auth";

const REFRESH_BUFFER_MS = 15 * 60 * 1000; // Refresh if expiring within 15 mins

export async function refreshExpiringTokens(): Promise<{ refreshed: number; failed: number }> {
  if (!process.env.INTEGRATION_ENCRYPTION_KEY) {
    return { refreshed: 0, failed: 0 };
  }

  const now = new Date();
  const threshold = new Date(now.getTime() + REFRESH_BUFFER_MS);

  const credentials = await db.integrationCredential.findMany({
    where: {
      status: "CONNECTED",
      OR: [
        { expiresAt: { lt: threshold } },
        { expiresAt: null },
      ],
    },
    include: {
      workspace: { select: { name: true } },
    },
  });

  let refreshed = 0;
  let failed = 0;

  for (const cred of credentials) {
    try {
      const refreshedTokens = await refreshTokenForProvider(
        cred.provider,
        cred.refreshTokenEncrypted,
        cred.workspaceId
      );

      if (refreshedTokens) {
        await db.integrationCredential.update({
          where: { id: cred.id },
          data: {
            accessTokenEncrypted: encryptToken(refreshedTokens.accessToken),
            refreshTokenEncrypted: refreshedTokens.refreshToken
              ? encryptToken(refreshedTokens.refreshToken)
              : undefined,
            expiresAt: refreshedTokens.expiresAt,
            status: "CONNECTED",
            ...(refreshedTokens.scopes !== undefined
              ? { scopes: refreshedTokens.scopes }
              : {}),
          },
        });
        refreshed++;
      }
    } catch (error) {
      failed++;
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      await db.integrationCredential.update({
        where: { id: cred.id },
        data: { status: "ERROR_ACTION_REQUIRED" },
      });

      await db.integrationConfig.updateMany({
        where: { workspaceId: cred.workspaceId, provider: cred.provider },
        data: {
          lastErrorAt: now,
          lastErrorMessage: `Token refresh failed: ${errorMessage}`,
        },
      });

      const owner = await db.userWorkspace.findFirst({
        where: { workspaceId: cred.workspaceId, role: "OWNER_CCO", ...activeUserWorkspaceWhere },
        include: { user: { select: { email: true } } },
      });
      if (owner?.user?.email) {
        await sendIntegrationReconnectEmail({
          email: owner.user.email,
          workspaceName: cred.workspace.name,
          provider: cred.provider,
        });
      }
    }
  }

  return { refreshed, failed };
}

async function refreshZoomToken(refreshToken: string): Promise<{
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  scopes?: string;
} | null> {
  const clientId = process.env.ZOOM_CLIENT_ID;
  const clientSecret = process.env.ZOOM_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  }).toString();

  const res = await fetch("https://zoom.us/oauth/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!res.ok) return null;

  const data = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
  };

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: data.expires_in
      ? new Date(Date.now() + data.expires_in * 1000)
      : undefined,
    scopes: data.scope,
  };
}

async function refreshTeamsToken(refreshToken: string): Promise<{
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
} | null> {
  const clientId = process.env.TEAMS_CLIENT_ID;
  const clientSecret = process.env.TEAMS_CLIENT_SECRET;
  const tenantId = process.env.TEAMS_TENANT_ID ?? "common";
  if (!clientId || !clientSecret) return null;

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  }).toString();

  const res = await fetch(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    }
  );

  if (!res.ok) return null;

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

async function refreshTokenForProvider(
  provider: IntegrationProvider,
  refreshTokenEncrypted: string | null,
  _workspaceId: string
): Promise<{
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  scopes?: string;
} | null> {
  if (!refreshTokenEncrypted) return null;

  const refreshToken = decryptToken(refreshTokenEncrypted);

  switch (provider) {
    case "ZOOM":
      return refreshZoomToken(refreshToken);
    case "TEAMS":
      return refreshTeamsToken(refreshToken);
    case "SHAREPOINT":
      // Same Azure AD app + refresh contract as Microsoft Teams
      return refreshTeamsToken(refreshToken);
    case "GMAIL_MAIL":
      // Workspace-level Gmail credential. Per-connection delegated tokens are
      // refreshed on demand in gmail-auth.getConnectionAccessToken.
      return refreshGmailToken(refreshToken);
    case "ZOHO_CRM": {
      const intConf = await db.integrationConfig.findUnique({
        where: { workspaceId_provider: { workspaceId: _workspaceId, provider: "ZOHO_CRM" } },
      });
      if (!intConf) return null;
      const c = (intConf.config as { accountsBase?: string; apiDomain?: string }) ?? {};
      const accountsBase = c.accountsBase ?? "https://accounts.zoho.com";
      const t = await exchangeZohoRefreshToken(refreshToken, accountsBase);
      if (!t) return null;
      if (t.apiDomain) {
        await db.integrationConfig.update({
          where: { id: intConf.id },
          data: {
            config: {
              ...c,
              apiDomain: t.apiDomain,
              accountsBase: c.accountsBase ?? accountsBase,
            },
          },
        });
      }
      return {
        accessToken: t.accessToken,
        refreshToken: t.refreshToken,
        expiresAt: t.expiresAt,
      };
    }
    case "GOOGLE_DRIVE":
    case "DOCUSIGN":
    case "SLACK":
    case "WEALTHBOX":
    case "SALESFORCE":
    case "COMPLYSCI":
      // Provider-specific refresh will be implemented when adapters are built
      // For now, throw to simulate failure (or return null to skip)
      throw new Error(`${provider} token refresh not yet implemented`);
    case "REDTAIL":
    case "RIA_IN_A_BOX":
    case "SMARTVAULT":
    case "TEAMS_BOT":
      // API key based — no refresh
      return null;
    default:
      return null;
  }
}

const FRESH_THRESHOLD_MS = 5 * 60 * 1000;

/**
 * Returns a usable access token, refreshing the credential row if near expiry.
 */
export async function getValidAccessTokenForProvider(
  workspaceId: string,
  provider: IntegrationProvider
): Promise<string | null> {
  if (!process.env.INTEGRATION_ENCRYPTION_KEY) {
    return null;
  }

  const cred = await db.integrationCredential.findUnique({
    where: { workspaceId_provider: { workspaceId, provider } },
  });
  if (!cred || cred.status !== "CONNECTED") {
    return null;
  }

  const threshold = new Date(Date.now() + FRESH_THRESHOLD_MS);
  if (cred.expiresAt && cred.expiresAt > threshold) {
    return decryptToken(cred.accessTokenEncrypted);
  }
  if (!cred.refreshTokenEncrypted) {
    return decryptToken(cred.accessTokenEncrypted);
  }

  const refreshed = await refreshTokenForProvider(
    provider,
    cred.refreshTokenEncrypted,
    workspaceId
  );
  if (refreshed) {
    await db.integrationCredential.update({
      where: { id: cred.id },
      data: {
        accessTokenEncrypted: encryptToken(refreshed.accessToken),
        refreshTokenEncrypted: refreshed.refreshToken
          ? encryptToken(refreshed.refreshToken)
          : undefined,
        expiresAt: refreshed.expiresAt,
        status: "CONNECTED",
        ...(refreshed.scopes !== undefined ? { scopes: refreshed.scopes } : {}),
      },
    });
    return refreshed.accessToken;
  }
  return null;
}
