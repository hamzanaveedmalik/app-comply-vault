/**
 * Base adapter — extensions implement provider-specific logic
 * Epic 6 Story 6.1a: Base class for integrations to extend
 */

import type { IntegrationAdapter, ConnectResult, SyncResult } from "./types";

export abstract class BaseIntegrationAdapter implements IntegrationAdapter {
  abstract readonly provider: IntegrationAdapter["provider"];

  abstract connect(params: {
    workspaceId: string;
    userId: string;
    authCode?: string;
    redirectUri?: string;
  }): Promise<ConnectResult>;

  abstract sync(params: {
    workspaceId: string;
    meetingId: string;
    payload: Record<string, unknown>;
  }): Promise<SyncResult>;

  abstract disconnect(params: { workspaceId: string }): Promise<{ success: boolean; error?: string }>;

  abstract handleWebhook(params: {
    rawBody: string;
    headers: Record<string, string>;
  }): Promise<Record<string, unknown> | null>;
}
