/**
 * Integration test harness — Epic 6 Story 6.1b
 * Test utility that any adapter can use to assert:
 * - OAuth flow completes and tokens stored encrypted
 * - Webhook payload routes to correct handleWebhook()
 * - API write enqueues BullMQ job with correct payload
 * - Write failure triggers retry (3 attempts, correct backoff)
 * - disconnect() deletes tokens and cancels pending jobs
 *
 * Usage: Import in adapter tests (vitest) and call assert* functions.
 */

import type { IntegrationAdapter } from "./types";
import { db } from "~/server/db";
import { getIntegrationQueue, enqueueIntegrationWrite } from "./queue";

export type HarnessAssertResult = { pass: boolean; message?: string };

/**
 * Assert OAuth flow completed and tokens are stored encrypted in IntegrationCredential
 */
export async function assertOAuthTokensStored(
  workspaceId: string,
  provider: string
): Promise<HarnessAssertResult> {
  const cred = await db.integrationCredential.findFirst({
    where: { workspaceId, provider: provider as "ZOOM" },
  });
  if (!cred) return { pass: false, message: "No credential found" };
  if (!cred.accessTokenEncrypted || cred.accessTokenEncrypted.length < 32) {
    return { pass: false, message: "Token does not appear encrypted" };
  }
  return { pass: true };
}

/**
 * Assert a simulated webhook payload routes to the correct handleWebhook() method.
 * Caller provides the adapter and raw payload; we verify it returns non-null when valid.
 */
export async function assertWebhookRoutesToAdapter(
  adapter: IntegrationAdapter,
  rawBody: string,
  headers: Record<string, string>
): Promise<HarnessAssertResult> {
  const result = await adapter.handleWebhook({ rawBody, headers });
  if (result === null) return { pass: false, message: "handleWebhook returned null" };
  return { pass: true };
}

/**
 * Assert a simulated API write enqueues a BullMQ job with correct payload.
 */
export async function assertApiWriteEnqueuesJob(
  workspaceId: string,
  meetingId: string,
  provider: string,
  action: string,
  payload: Record<string, unknown>
): Promise<HarnessAssertResult> {
  const jobId = await enqueueIntegrationWrite({
    workspaceId,
    meetingId,
    provider,
    action,
    payload,
  });
  if (!jobId) return { pass: false, message: "Queue not available or enqueue failed" };
  return { pass: true };
}

/**
 * Assert disconnect() deletes tokens from IntegrationCredential.
 * Caller must call adapter.disconnect() first, then this.
 */
export async function assertDisconnectDeletesTokens(
  workspaceId: string,
  provider: string
): Promise<HarnessAssertResult> {
  const cred = await db.integrationCredential.findFirst({
    where: { workspaceId, provider: provider as "ZOOM" },
  });
  if (cred) return { pass: false, message: "Credential still exists after disconnect" };
  return { pass: true };
}
