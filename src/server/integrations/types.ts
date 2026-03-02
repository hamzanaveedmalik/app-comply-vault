/**
 * IntegrationHub — Common adapter interface and types
 * Epic 6 Story 6.1a: Each integration implements this contract
 */

import type { IntegrationProvider } from "../../../generated/prisma";

export type { IntegrationProvider };

/** OAuth tokens (plaintext — caller encrypts before storage) */
export type OAuthTokens = {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  scopes?: string;
};

/** Result of connect() — OAuth flow completion */
export type ConnectResult = {
  success: boolean;
  credentialId?: string;
  accountDisplayName?: string;
  error?: string;
};

/** Result of sync() — integration write (CRM note, upload, etc.) */
export type SyncResult = {
  success: boolean;
  externalId?: string;
  error?: string;
};

/** Webhook payload — provider-specific, validated by handleWebhook */
export type WebhookPayload = Record<string, unknown>;

/** Adapter interface — all integrations must implement */
export interface IntegrationAdapter {
  readonly provider: IntegrationProvider;

  /**
   * Initiate or complete OAuth flow. Stores tokens in IntegrationCredential.
   */
  connect(params: {
    workspaceId: string;
    userId: string;
    authCode?: string;
    redirectUri?: string;
  }): Promise<ConnectResult>;

  /**
   * Perform integration write (CRM note, document upload, envelope, etc.)
   */
  sync(params: {
    workspaceId: string;
    meetingId: string;
    payload: Record<string, unknown>;
  }): Promise<SyncResult>;

  /**
   * Disconnect: delete tokens, cancel pending jobs, purge config
   */
  disconnect(params: { workspaceId: string }): Promise<{ success: boolean; error?: string }>;

  /**
   * Handle incoming webhook from provider. Verifies signature, returns parsed payload or null if invalid.
   */
  handleWebhook(params: {
    rawBody: string;
    headers: Record<string, string>;
  }): Promise<WebhookPayload | null>;
}
