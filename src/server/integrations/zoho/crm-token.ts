/**
 * Zoho CRM access token + api_domain (Epic 3)
 */

import { db } from "~/server/db";
import { decryptToken, encryptToken } from "../crypto";

const FRESH_MS = 5 * 60 * 1000;

type ZohoConfig = {
  apiDomain?: string;
  accountsBase?: string;
  accountEmail?: string;
};

function getDefaultAccountsBase(): string {
  return (process.env.ZOHO_CRM_ACCOUNTS_DOMAIN ?? "https://accounts.zoho.com").replace(/\/$/, "");
}

function getClientSecret(): { clientId: string; clientSecret: string } | null {
  const clientId = process.env.ZOHO_CRM_CLIENT_ID;
  const clientSecret = process.env.ZOHO_CRM_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

/** Used by `token-refresh.ts` and `getValidZohoCrmContext` */
export async function exchangeZohoRefreshToken(
  refreshToken: string,
  accountsBase: string
): Promise<{
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  apiDomain?: string;
} | null> {
  const cfg = getClientSecret();
  if (!cfg) return null;

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
  }).toString();

  const res = await fetch(`${accountsBase}/oauth/v2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) return null;

  const data = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    api_domain?: string;
  };

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: data.expires_in
      ? new Date(Date.now() + data.expires_in * 1000)
      : undefined,
    apiDomain: data.api_domain?.replace(/\/$/, ""),
  };
}

/**
 * Returns a valid CRM access token and API base URL (e.g. https://www.zohoapis.com).
 */
export async function getValidZohoCrmContext(
  workspaceId: string
): Promise<{ accessToken: string; apiDomain: string; integrationConfigId: string } | null> {
  if (!process.env.INTEGRATION_ENCRYPTION_KEY) {
    return null;
  }

  const [cred, intConfig] = await Promise.all([
    db.integrationCredential.findUnique({
      where: { workspaceId_provider: { workspaceId, provider: "ZOHO_CRM" } },
    }),
    db.integrationConfig.findUnique({
      where: { workspaceId_provider: { workspaceId, provider: "ZOHO_CRM" } },
    }),
  ]);

  if (!cred || cred.status !== "CONNECTED" || !intConfig) {
    return null;
  }

  const c = (intConfig.config as ZohoConfig) ?? {};
  const apiDomain = c.apiDomain;
  if (!apiDomain) {
    return null;
  }

  const accountsBase = c.accountsBase ?? getDefaultAccountsBase();
  const threshold = new Date(Date.now() + FRESH_MS);
  if (cred.expiresAt && cred.expiresAt > threshold && cred.accessTokenEncrypted) {
    return {
      accessToken: decryptToken(cred.accessTokenEncrypted),
      apiDomain,
      integrationConfigId: intConfig.id,
    };
  }
  if (!cred.refreshTokenEncrypted) {
    return {
      accessToken: decryptToken(cred.accessTokenEncrypted),
      apiDomain,
      integrationConfigId: intConfig.id,
    };
  }

  const refreshToken = decryptToken(cred.refreshTokenEncrypted);
  const refreshed = await exchangeZohoRefreshToken(refreshToken, accountsBase);
  if (!refreshed) {
    return null;
  }

  const newApi = refreshed.apiDomain ?? apiDomain;
  await db.integrationCredential.update({
    where: { id: cred.id },
    data: {
      accessTokenEncrypted: encryptToken(refreshed.accessToken),
      refreshTokenEncrypted: refreshed.refreshToken
        ? encryptToken(refreshed.refreshToken)
        : undefined,
      expiresAt: refreshed.expiresAt,
      status: "CONNECTED",
    },
  });

  if (refreshed.apiDomain && refreshed.apiDomain !== apiDomain) {
    await db.integrationConfig.update({
      where: { id: intConfig.id },
      data: {
        config: { ...c, apiDomain: newApi, accountsBase },
      },
    });
  }

  return {
    accessToken: refreshed.accessToken,
    apiDomain: newApi,
    integrationConfigId: intConfig.id,
  };
}
