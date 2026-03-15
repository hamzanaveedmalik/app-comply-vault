/**
 * Microsoft Teams integration adapter — Epic 1 Story 1.4
 * Azure AD OAuth, Graph API, callRecord subscription
 */

import { db } from "~/server/db";
import { encryptToken } from "../crypto";
import { BaseIntegrationAdapter } from "../base-adapter";
import type { ConnectResult, OAuthTokens } from "../types";
import { IntegrationProvider } from "../../../../generated/prisma";

const AZURE_AUTH_BASE = "https://login.microsoftonline.com";
const GRAPH_BASE = "https://graph.microsoft.com/v1.0";
const SCOPES = [
  "OnlineMeetings.Read",
  "OnlineMeetingTranscript.Read.All",
  "User.Read",
  "offline_access",
].join(" ");

function getTeamsConfig() {
  const clientId = process.env.TEAMS_CLIENT_ID;
  const clientSecret = process.env.TEAMS_CLIENT_SECRET;
  const tenantId = process.env.TEAMS_TENANT_ID ?? "common";
  if (!clientId || !clientSecret) {
    throw new Error("TEAMS_CLIENT_ID and TEAMS_CLIENT_SECRET must be set");
  }
  return { clientId, clientSecret, tenantId };
}

function getAppBaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_APP_URL ?? process.env.AUTH_URL;
  if (!url) {
    throw new Error("NEXT_PUBLIC_APP_URL or AUTH_URL must be set for Teams OAuth redirect");
  }
  return url.replace(/\/$/, "");
}

export function getTeamsAuthorizeUrl(state: string): string {
  const { clientId, tenantId } = getTeamsConfig();
  const redirectUri = `${getAppBaseUrl()}/api/integrations/teams/callback`;
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
  const { clientId, clientSecret, tenantId } = getTeamsConfig();
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
    throw new Error(`Teams token exchange failed: ${res.status} ${err}`);
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

async function getTeamsUserEmail(accessToken: string): Promise<string> {
  try {
    const res = await fetch(`${GRAPH_BASE}/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return "Teams account";
    const data = (await res.json()) as { mail?: string; userPrincipalName?: string };
    return data.mail ?? data.userPrincipalName ?? "Teams account";
  } catch {
    return "Teams account";
  }
}

async function getOrganizerId(accessToken: string): Promise<string | null> {
  try {
    const res = await fetch(`${GRAPH_BASE}/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { id?: string };
    return data.id ?? null;
  } catch {
    return null;
  }
}

async function subscribeTranscriptNotification(
  accessToken: string,
  organizerId: string
): Promise<string | null> {
  const webhookUrl = `${getAppBaseUrl()}/api/webhooks/v1/teams/transcript`;
  const res = await fetch(`${GRAPH_BASE}/subscriptions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      changeType: "created",
      notificationUrl: webhookUrl,
      resource: `users/${organizerId}/onlineMeetings/getAllTranscripts`,
      expirationDateTime: new Date(Date.now() + 4230 * 60 * 1000).toISOString(),
      clientState: process.env.TEAMS_WEBHOOK_CLIENT_STATE ?? "complyvault",
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("Teams transcript subscription failed:", res.status, err);
    return null;
  }

  const data = (await res.json()) as { id?: string };
  return data.id ?? null;
}

export const teamsAdapter = new (class extends BaseIntegrationAdapter {
  readonly provider: IntegrationProvider = "TEAMS";

  async connect(params: {
    workspaceId: string;
    userId: string;
    authCode?: string;
    redirectUri?: string;
  }): Promise<ConnectResult> {
    if (!params.authCode || !params.redirectUri) {
      return {
        success: false,
        error: "authCode and redirectUri required to complete Teams OAuth",
      };
    }

    const tokens = await exchangeCodeForTokens(params.authCode, params.redirectUri);
    const accountEmail = await getTeamsUserEmail(tokens.accessToken);
    const organizerId = await getOrganizerId(tokens.accessToken);
    const subscriptionId =
      organizerId
        ? await subscribeTranscriptNotification(tokens.accessToken, organizerId)
        : null;

    const credential = await db.integrationCredential.upsert({
      where: {
        workspaceId_provider: {
          workspaceId: params.workspaceId,
          provider: "TEAMS",
        },
      },
      create: {
        workspaceId: params.workspaceId,
        provider: "TEAMS",
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
          provider: "TEAMS",
        },
      },
      select: { config: true },
    });
    const existingConfig = (existing?.config as Record<string, unknown>) ?? {};

    await db.integrationConfig.upsert({
      where: {
        workspaceId_provider: {
          workspaceId: params.workspaceId,
          provider: "TEAMS",
        },
      },
      create: {
        workspaceId: params.workspaceId,
        provider: "TEAMS",
        config: {
          accountEmail,
          organizerId: organizerId ?? undefined,
          subscriptionId: subscriptionId ?? undefined,
        },
      },
      update: {
        config: {
          ...existingConfig,
          accountEmail,
          organizerId: organizerId ?? undefined,
          subscriptionId: subscriptionId ?? undefined,
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
    throw new Error("Teams adapter does not support sync — ingestion is webhook-triggered");
  }

  async disconnect(params: { workspaceId: string }): Promise<{ success: boolean; error?: string }> {
    const credential = await db.integrationCredential.findUnique({
      where: {
        workspaceId_provider: { workspaceId: params.workspaceId, provider: "TEAMS" },
      },
    });
    if (!credential) return { success: true };

    const config = await db.integrationConfig.findUnique({
      where: {
        workspaceId_provider: { workspaceId: params.workspaceId, provider: "TEAMS" },
      },
    });

    if (config?.config && typeof config.config === "object" && "subscriptionId" in config.config) {
      const subId = (config.config as { subscriptionId?: string }).subscriptionId;
      if (subId) {
        try {
          const { decryptToken } = await import("../crypto");
          const accessToken = decryptToken(credential.accessTokenEncrypted);
          await fetch(`${GRAPH_BASE}/subscriptions/${subId}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${accessToken}` },
          });
        } catch {
          // Best effort
        }
      }
    }

    await db.integrationCredential.delete({
      where: { id: credential.id },
    });
    await db.integrationConfig.deleteMany({
      where: { workspaceId: params.workspaceId, provider: "TEAMS" },
    });

    return { success: true };
  }

  async handleWebhook(): Promise<Record<string, unknown> | null> {
    // Story 1.5: Validate and parse callRecord notification
    return null;
  }
})();
