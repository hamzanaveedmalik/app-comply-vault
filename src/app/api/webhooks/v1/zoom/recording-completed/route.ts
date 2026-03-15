/**
 * POST /api/webhooks/v1/zoom/recording-completed
 * Epic 1 Story 1.1: Zoom webhook endpoint for recording.completed
 * Epic 6 Story 6.5: Webhook signature verification
 *
 * Handles: (1) Zoom URL validation (plainToken challenge), (2) recording.completed events
 * Story 1.2a will add ingestion pipeline trigger.
 */

import { zoomAdapter } from "~/server/integrations/adapters/zoom";
import { NextRequest, NextResponse } from "next/server";
import { createHmac } from "node:crypto";

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const headers: Record<string, string> = {};
  request.headers.forEach((v, k) => {
    headers[k.toLowerCase()] = v;
  });

  try {
    const body = rawBody ? (JSON.parse(rawBody) as Record<string, unknown>) : {};

    const plainToken =
      (body.plainToken as string) ??
      (typeof body.payload === "object" && body.payload !== null && "plainToken" in body.payload
        ? (body.payload as { plainToken?: string }).plainToken
        : undefined);

    if (plainToken && typeof plainToken === "string") {
      const webhookSecret = process.env.ZOOM_WEBHOOK_SECRET;
      if (!webhookSecret) {
        return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
      }
      const encrypted = createHmac("sha256", webhookSecret)
        .update(plainToken)
        .digest("hex");
      return NextResponse.json({ plainToken, encryptedToken: encrypted });
    }

    const payload = await zoomAdapter.handleWebhook({ rawBody, headers });
    if (!payload) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    if ((payload.event as string) === "recording.completed") {
      // Story 1.2a: Enqueue ingestion job to BullMQ
      // For now, acknowledge receipt
    }

    return NextResponse.json({ received: true });
  } catch {
    return new NextResponse("Bad Request", { status: 400 });
  }
}
