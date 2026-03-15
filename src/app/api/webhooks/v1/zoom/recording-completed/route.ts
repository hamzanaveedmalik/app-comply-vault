/**
 * POST /api/webhooks/v1/zoom/recording-completed
 * Epic 1 Story 1.1: Zoom webhook endpoint for recording.completed
 * Epic 6 Story 6.5: Webhook signature verification
 * Story 1.2a: Enqueue ingestion job to QStash
 */

import { zoomAdapter } from "~/server/integrations/adapters/zoom";
import { NextRequest, NextResponse } from "next/server";
import { createHmac } from "node:crypto";
import { publishZoomIngestionJob } from "~/server/qstash";

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
      const obj = payload.payload as Record<string, unknown> | undefined;
      const recordingObj = (typeof obj === "object" && obj !== null ? obj : {}) as {
        uuid?: string;
        host_email?: string;
        topic?: string;
        start_time?: string;
        duration?: number;
        download_token?: string;
        recording_files?: Array<{
          id?: string;
          file_type?: string;
          file_extension?: string;
          download_url?: string;
          download_token?: string;
          status?: string;
        }>;
      };

      const zoomMeetingId = String(recordingObj.uuid ?? recordingObj.id ?? "");
      const zoomMeetingNumericId = recordingObj.id ? String(recordingObj.id) : undefined;
      const hostEmail = recordingObj.host_email ?? "";
      const downloadToken = recordingObj.download_token ?? "";
      const files = recordingObj.recording_files ?? [];

      if (zoomMeetingId && hostEmail && downloadToken && files.length > 0) {
        const ingestionPayload = {
          zoomMeetingId,
          zoomMeetingNumericId,
          hostEmail: String(hostEmail),
          topic: recordingObj.topic as string | undefined,
          startTime: recordingObj.start_time as string | undefined,
          duration: recordingObj.duration as number | undefined,
          downloadToken: String(downloadToken),
          recordingFiles: files.map((f) => ({
            id: f.id,
            fileType: f.file_type ?? f.file_extension,
            fileExtension: f.file_extension ?? f.file_type,
            downloadUrl: f.download_url,
            downloadToken: f.download_token,
            status: f.status,
          })),
        };

        try {
          await publishZoomIngestionJob(ingestionPayload);
        } catch (err) {
          console.error("[Zoom webhook] Failed to enqueue ingestion:", err);
        }
      }
    }

    return NextResponse.json({ received: true });
  } catch {
    return new NextResponse("Bad Request", { status: 400 });
  }
}
