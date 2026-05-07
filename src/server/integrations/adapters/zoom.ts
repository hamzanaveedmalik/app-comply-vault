/**
 * Zoom integration adapter — Epic 1 Story 1.1
 * OAuth connection, webhook handling, recording.completed subscription
 */

import { createHmac } from "node:crypto";
import { db } from "~/server/db";
import { encryptToken } from "../crypto";
import { BaseIntegrationAdapter } from "../base-adapter";
import type { ConnectResult, OAuthTokens } from "../types";
import { IntegrationProvider } from "../../../../generated/prisma";

const ZOOM_AUTH_URL = "https://zoom.us/oauth/authorize";
const ZOOM_TOKEN_URL = "https://zoom.us/oauth/token";
const ZOOM_API_BASE = "https://api.zoom.us/v2";
const ZOOM_WEBHOOK_URL = "https://api.zoom.us/v2/webhooks";

// Granular Cloud Recording scopes. Zoom List recordings requires both list_user_recordings and :admin (error 4711 if missing).
const SCOPES = [
  "cloud_recording:read:list_user_recordings",
  "cloud_recording:read:list_user_recordings:admin",
  "cloud_recording:read:list_recording_files",
  "cloud_recording:read:recording",
  "cloud_recording:read:content",
  "cloud_recording:read:meeting_transcript",
  "user:read:user",
  "user:read:email",
].join(" ");

function getZoomConfig() {
  const clientId = process.env.ZOOM_CLIENT_ID;
  const clientSecret = process.env.ZOOM_CLIENT_SECRET;
  const webhookSecret = process.env.ZOOM_WEBHOOK_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("ZOOM_CLIENT_ID and ZOOM_CLIENT_SECRET must be set");
  }
  return { clientId, clientSecret, webhookSecret };
}

function getAppBaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_APP_URL ?? process.env.AUTH_URL;
  if (!url) {
    throw new Error("NEXT_PUBLIC_APP_URL or AUTH_URL must be set for Zoom OAuth redirect");
  }
  return url.replace(/\/$/, "");
}

export function getZoomAuthorizeUrl(state: string): string {
  const { clientId } = getZoomConfig();
  const redirectUri = `${getAppBaseUrl()}/api/integrations/zoom/callback`;
  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: SCOPES,
    state,
  });
  return `${ZOOM_AUTH_URL}?${params.toString()}`;
}

async function exchangeCodeForTokens(code: string, redirectUri: string): Promise<OAuthTokens> {
  const { clientId, clientSecret } = getZoomConfig();
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
  }).toString();

  const res = await fetch(ZOOM_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Zoom token exchange failed: ${res.status} ${err}`);
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

async function getZoomUserEmail(accessToken: string): Promise<string> {
  try {
    const res = await fetch(`${ZOOM_API_BASE}/users/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) {
      return "Zoom account";
    }

    const data = (await res.json()) as { email?: string; id?: string };
    return data.email ?? `Zoom user ${data.id ?? "connected"}`;
  } catch {
    return "Zoom account";
  }
}

async function subscribeRecordingWebhook(accessToken: string): Promise<string | null> {
  const webhookUrl = `${getAppBaseUrl()}/api/webhooks/v1/zoom/recording-completed`;

  const res = await fetch(ZOOM_WEBHOOK_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      event_types: ["recording.completed"],
      webhook_url: webhookUrl,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("Zoom webhook subscription failed:", res.status, err);
    return null;
  }

  const data = (await res.json()) as { id?: string };
  return data.id ?? null;
}

export const zoomAdapter = new (class extends BaseIntegrationAdapter {
  readonly provider: IntegrationProvider = "ZOOM";

  async connect(params: {
    workspaceId: string;
    userId: string;
    authCode?: string;
    redirectUri?: string;
  }): Promise<ConnectResult> {
    if (!params.authCode || !params.redirectUri) {
      return {
        success: false,
        error: "authCode and redirectUri required to complete Zoom OAuth",
      };
    }

    const tokens = await exchangeCodeForTokens(params.authCode, params.redirectUri);
    const accountEmail = await getZoomUserEmail(tokens.accessToken);

    const webhookId = await subscribeRecordingWebhook(tokens.accessToken);

    const credential = await db.integrationCredential.upsert({
      where: {
        workspaceId_provider: {
          workspaceId: params.workspaceId,
          provider: "ZOOM",
        },
      },
      create: {
        workspaceId: params.workspaceId,
        provider: "ZOOM",
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
          provider: "ZOOM",
        },
      },
      select: { config: true },
    });

    const existingConfig = (existing?.config as Record<string, unknown>) ?? {};
    await db.integrationConfig.upsert({
      where: {
        workspaceId_provider: {
          workspaceId: params.workspaceId,
          provider: "ZOOM",
        },
      },
      create: {
        workspaceId: params.workspaceId,
        provider: "ZOOM",
        config: {
          accountEmail,
          webhookId: webhookId ?? undefined,
          recordingScope: "all",
        },
      },
      update: {
        config: {
          ...existingConfig,
          accountEmail,
          webhookId: webhookId ?? undefined,
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
    throw new Error("Zoom adapter does not support sync — ingestion is webhook-triggered");
  }

  async disconnect(params: { workspaceId: string }): Promise<{ success: boolean; error?: string }> {
    const credential = await db.integrationCredential.findUnique({
      where: {
        workspaceId_provider: { workspaceId: params.workspaceId, provider: "ZOOM" },
      },
    });
    if (!credential) return { success: true };

    const config = await db.integrationConfig.findUnique({
      where: {
        workspaceId_provider: { workspaceId: params.workspaceId, provider: "ZOOM" },
      },
    });

    if (config?.config && typeof config.config === "object" && "webhookId" in config.config) {
      const webhookId = (config.config as { webhookId?: string }).webhookId;
      if (webhookId) {
        try {
          const { decryptToken } = await import("../crypto");
          const accessToken = decryptToken(credential.accessTokenEncrypted);
          await fetch(`${ZOOM_WEBHOOK_URL}/${webhookId}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${accessToken}` },
          });
        } catch {
          // Best effort — credential will be deleted anyway
        }
      }
    }

    await db.integrationCredential.delete({
      where: { id: credential.id },
    });
    await db.integrationConfig.deleteMany({
      where: { workspaceId: params.workspaceId, provider: "ZOOM" },
    });

    return { success: true };
  }

  async handleWebhook(params: {
    rawBody: string;
    headers: Record<string, string>;
  }): Promise<Record<string, unknown> | null> {
    const { webhookSecret } = getZoomConfig();
    if (!webhookSecret) return null;

    const signature = params.headers["x-zm-signature"] ?? params.headers["x-zoom-signature"];
    if (!signature) return null;

    const [version, hash] = signature.split(",").reduce(
      (acc, part) => {
        const [k, v] = part.split("=");
        const value = v ?? "";
        if (k === "v0") acc[1] = value;
        else if (k === "signature") acc[0] = value;
        return acc;
      },
      ["", ""] as [string, string]
    );

    const message = `v0:${params.headers["x-zm-request-timestamp"] ?? ""}:${params.rawBody}`;
    const expected = createHmac("sha256", webhookSecret).update(message).digest("hex");

    if (expected !== hash) return null;

    try {
      return JSON.parse(params.rawBody) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
})();
