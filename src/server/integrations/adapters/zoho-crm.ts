/**
 * Zoho CRM — Epic 3 Stories 3.0 / 3.0a
 * OAuth via Zoho Accounts; API calls use api_domain from token response.
 */

import { db } from "~/server/db";
import { encryptToken } from "../crypto";
import { BaseIntegrationAdapter } from "../base-adapter";
import type { ConnectResult, OAuthTokens } from "../types";
import { IntegrationProvider } from "../../../../generated/prisma";

const DEFAULT_ACCOUNTS = "https://accounts.zoho.com";
const SCOPES = [
  "ZohoCRM.modules.contacts.READ",
  "ZohoCRM.modules.notes.CREATE",
  "ZohoCRM.users.READ",
  "ZohoCRM.org.READ",
].join(",");

function getAccountsBaseUrl(): string {
  return (process.env.ZOHO_CRM_ACCOUNTS_DOMAIN ?? DEFAULT_ACCOUNTS).replace(/\/$/, "");
}

function getAppBaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_APP_URL ?? process.env.AUTH_URL;
  if (!url) {
    throw new Error("NEXT_PUBLIC_APP_URL or AUTH_URL must be set for Zoho CRM OAuth");
  }
  return url.replace(/\/$/, "");
}

function getClientConfig(): { clientId: string; clientSecret: string } {
  const clientId = process.env.ZOHO_CRM_CLIENT_ID;
  const clientSecret = process.env.ZOHO_CRM_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("ZOHO_CRM_CLIENT_ID and ZOHO_CRM_CLIENT_SECRET must be set");
  }
  return { clientId, clientSecret };
}

export function getZohoCrmAuthorizeUrl(state: string): string {
  const { clientId } = getClientConfig();
  const redirectUri = `${getAppBaseUrl()}/api/integrations/zoho-crm/callback`;
  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: SCOPES,
    state,
    access_type: "offline",
    prompt: "consent",
  });
  return `${getAccountsBaseUrl()}/oauth/v2/auth?${params.toString()}`;
}

async function exchangeCodeForTokens(code: string, redirectUri: string): Promise<
  OAuthTokens & { apiDomain: string; accountsBase: string }
> {
  const { clientId, clientSecret } = getClientConfig();
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    client_id: clientId,
    client_secret: clientSecret,
  }).toString();

  const res = await fetch(`${getAccountsBaseUrl()}/oauth/v2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Zoho token exchange failed: ${res.status} ${err}`);
  }

  const data = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    api_domain: string;
  };

  if (!data.api_domain) {
    throw new Error("Zoho token response missing api_domain");
  }

  const expiresAt = data.expires_in
    ? new Date(Date.now() + data.expires_in * 1000)
    : undefined;

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt,
    scopes: SCOPES,
    apiDomain: data.api_domain.replace(/\/$/, ""),
    accountsBase: getAccountsBaseUrl(),
  };
}

async function getCurrentZohoUserEmail(
  accessToken: string,
  apiDomain: string
): Promise<string> {
  const url = `${apiDomain}/crm/v2/users?type=CurrentUser`;
  const res = await fetch(url, {
    headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
  });
  if (!res.ok) return "Zoho CRM";
  const data = (await res.json()) as {
    users?: Array<{ email?: string; full_name?: string }>;
  };
  const u = data.users?.[0];
  return u?.email ?? u?.full_name ?? "Zoho CRM";
}

export const zohoCrmAdapter = new (class extends BaseIntegrationAdapter {
  readonly provider: IntegrationProvider = "ZOHO_CRM";

  async connect(params: {
    workspaceId: string;
    userId: string;
    authCode?: string;
    redirectUri?: string;
  }): Promise<ConnectResult> {
    if (!params.authCode || !params.redirectUri) {
      return {
        success: false,
        error: "authCode and redirectUri required to complete Zoho CRM OAuth",
      };
    }

    const tokens = await exchangeCodeForTokens(params.authCode, params.redirectUri);
    const accountEmail = await getCurrentZohoUserEmail(tokens.accessToken, tokens.apiDomain);

    const credential = await db.integrationCredential.upsert({
      where: {
        workspaceId_provider: {
          workspaceId: params.workspaceId,
          provider: "ZOHO_CRM",
        },
      },
      create: {
        workspaceId: params.workspaceId,
        provider: "ZOHO_CRM",
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
          provider: "ZOHO_CRM",
        },
      },
      select: { config: true },
    });
    const existingConfig = (existing?.config as Record<string, unknown>) ?? {};

    await db.integrationConfig.upsert({
      where: {
        workspaceId_provider: {
          workspaceId: params.workspaceId,
          provider: "ZOHO_CRM",
        },
      },
      create: {
        workspaceId: params.workspaceId,
        provider: "ZOHO_CRM",
        config: {
          accountEmail,
          apiDomain: tokens.apiDomain,
          accountsBase: tokens.accountsBase,
        },
      },
      update: {
        config: {
          ...existingConfig,
          accountEmail,
          apiDomain: tokens.apiDomain,
          accountsBase: tokens.accountsBase,
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
    throw new Error("Zoho CRM has no pull sync");
  }

  async disconnect(params: { workspaceId: string }): Promise<{ success: boolean; error?: string }> {
    const credential = await db.integrationCredential.findUnique({
      where: {
        workspaceId_provider: { workspaceId: params.workspaceId, provider: "ZOHO_CRM" },
      },
    });
    if (!credential) return { success: true };
    await db.integrationCredential.delete({ where: { id: credential.id } });
    await db.integrationConfig.deleteMany({
      where: { workspaceId: params.workspaceId, provider: "ZOHO_CRM" },
    });
    return { success: true };
  }

  async handleWebhook(): Promise<Record<string, unknown> | null> {
    return null;
  }
})();
