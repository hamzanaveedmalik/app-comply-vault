/**
 * Webhook signature verification — Epic 6 Story 6.5
 * Zoom, DocuSign, Slack, Microsoft Graph
 */

import { createHmac, timingSafeEqual } from "node:crypto";

export function verifyZoomWebhook(
  rawBody: string,
  signature: string,
  secret: string
): boolean {
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  try {
    return timingSafeEqual(Buffer.from(signature, "hex"), Buffer.from(expected, "hex"));
  } catch {
    return false;
  }
}

export function verifySlackSignature(
  rawBody: string,
  signature: string,
  secret: string
): boolean {
  // X-Slack-Signature: v0=hex
  const prefix = "v0=";
  if (!signature.startsWith(prefix)) return false;
  const received = signature.slice(prefix.length);
  const computed = createHmac("sha256", secret).update(rawBody).digest("hex");
  try {
    return timingSafeEqual(Buffer.from(received, "hex"), Buffer.from(computed, "hex"));
  } catch {
    return false;
  }
}

export function verifyDocuSignConnect(
  rawBody: string,
  signature: string,
  secret: string
): boolean {
  const expected = createHmac("sha256", secret).update(rawBody).digest("base64");
  try {
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}
