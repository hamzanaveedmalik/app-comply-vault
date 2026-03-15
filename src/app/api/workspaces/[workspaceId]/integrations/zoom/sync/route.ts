/**
 * POST /api/workspaces/[workspaceId]/integrations/zoom/sync
 * Manual sync: fetch recent Zoom recordings and enqueue ingestion jobs.
 * Use when webhooks don't reach the app (e.g. localhost, Zoom app config).
 */

import { db } from "~/server/db";
import { requireAppAccess } from "~/server/auth/guards";
import { publishZoomIngestionJob } from "~/server/qstash";
import { env } from "~/env";
import { NextResponse } from "next/server";
import { decryptToken } from "~/server/integrations/crypto";

const ZOOM_API_BASE = "https://api.zoom.us/v2";

type ZoomRecordingFile = {
  id?: string;
  file_type?: string;
  file_extension?: string;
  download_url?: string;
  download_token?: string;
  status?: string;
};

type ZoomMeetingRecordings = {
  uuid?: string;
  id?: number;
  host_id?: string;
  topic?: string;
  start_time?: string;
  duration?: number;
  host_email?: string;
  download_token?: string;
  recording_files?: ZoomRecordingFile[];
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  const access = await requireAppAccess();
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }
  if (access.session.user.role !== "OWNER_CCO") {
    return NextResponse.json({ error: "Only workspace owners can sync Zoom" }, { status: 403 });
  }

  const { workspaceId } = await params;
  if (workspaceId !== access.workspaceId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const credential = await db.integrationCredential.findUnique({
    where: { workspaceId_provider: { workspaceId, provider: "ZOOM" } },
  });
  if (!credential) {
    return NextResponse.json({ error: "Zoom not connected" }, { status: 404 });
  }

  const config = await db.integrationConfig.findUnique({
    where: { workspaceId_provider: { workspaceId, provider: "ZOOM" } },
  });
  const accountEmail = (config?.config as { accountEmail?: string } | null)?.accountEmail;
  if (!accountEmail) {
    return NextResponse.json({ error: "Zoom account email not found" }, { status: 500 });
  }

  let accessToken: string;
  try {
    accessToken = decryptToken(credential.accessTokenEncrypted);
  } catch {
    return NextResponse.json(
      { error: "Zoom token invalid or expired. Please reconnect Zoom." },
      { status: 401 }
    );
  }

  const from = new Date();
  from.setDate(from.getDate() - 30);
  const to = new Date();
  const fromStr = from.toISOString().slice(0, 10);
  const toStr = to.toISOString().slice(0, 10);

  const listUrl = `${ZOOM_API_BASE}/users/me/recordings?from=${fromStr}&to=${toStr}&page_size=30`;
  const listRes = await fetch(listUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!listRes.ok) {
    const errText = await listRes.text();
    console.error("[Zoom sync] List recordings failed:", listRes.status, errText);
    if (listRes.status === 401) {
      return NextResponse.json(
        { error: "Zoom token expired. Please reconnect Zoom." },
        { status: 401 }
      );
    }
    if (listRes.status === 403) {
      return NextResponse.json(
        {
          error:
            "Zoom account lacks recording:read scope. Reconnect Zoom to grant access to list recordings.",
        },
        { status: 403 }
      );
    }
    return NextResponse.json(
      { error: `Zoom API error: ${listRes.status}` },
      { status: 502 }
    );
  }

  const listData = (await listRes.json()) as {
    meetings?: Array<{
      uuid?: string;
      id?: number;
      host_id?: string;
      topic?: string;
      start_time?: string;
      duration?: number;
    }>;
  };

  const meetings = listData.meetings ?? [];
  if (meetings.length === 0) {
    return NextResponse.json({
      success: true,
      enqueued: 0,
      message: "No recordings found in the last 30 days.",
    });
  }

  let enqueued = 0;
  const errors: string[] = [];

  for (const meeting of meetings) {
    const uuid = meeting.uuid ?? String(meeting.id ?? "");
    if (!uuid) continue;

    const detailUrl = `${ZOOM_API_BASE}/meetings/${encodeURIComponent(uuid)}/recordings?include_fields=download_access_token`;
    const detailRes = await fetch(detailUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!detailRes.ok) {
      errors.push(`Meeting ${uuid.slice(0, 8)}: ${detailRes.status}`);
      continue;
    }

    const detail = (await detailRes.json()) as ZoomMeetingRecordings & {
      download_access_token?: string;
    };
    const files = detail.recording_files ?? [];
    const downloadToken =
      detail.download_token ??
      detail.download_access_token ??
      files[0]?.download_token ??
      "";

    const hasDownloadable = files.some((f) => f.download_url);

    if (!hasDownloadable) {
      continue;
    }

    const ingestionPayload = {
      zoomMeetingId: uuid,
      zoomMeetingNumericId: detail.id ? String(detail.id) : undefined,
      hostEmail: detail.host_email ?? accountEmail,
      topic: detail.topic ?? meeting.topic,
      startTime: detail.start_time ?? meeting.start_time,
      duration: detail.duration ?? meeting.duration,
      downloadToken: String(downloadToken || files[0]?.download_token ?? ""),
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
      let ok = false;
      if (env.QSTASH_TOKEN) {
        const msgId = await publishZoomIngestionJob(ingestionPayload);
        ok = !!msgId;
      }
      if (!ok) {
        const baseUrl =
          env.NEXT_PUBLIC_APP_URL ??
          (typeof request.url === "string" ? new URL(request.url).origin : "http://localhost:3000");
        if (baseUrl.includes("localhost") || baseUrl.includes("127.0.0.1")) {
          const ingestRes = await fetch(`${baseUrl}/api/jobs/zoom-ingest`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(ingestionPayload),
          });
          ok = ingestRes.ok;
        }
      }
      if (ok) enqueued++;
    } catch (err) {
      errors.push(`Meeting ${uuid.slice(0, 8)}: ${err instanceof Error ? err.message : "Unknown"}`);
    }
  }

  await db.integrationConfig.update({
    where: { workspaceId_provider: { workspaceId, provider: "ZOOM" } },
    data: { lastSyncAt: new Date(), lastErrorMessage: errors.length > 0 ? errors.join("; ") : null },
  });

  return NextResponse.json({
    success: true,
    enqueued,
    total: meetings.length,
    errors: errors.length > 0 ? errors : undefined,
    message:
      enqueued > 0
        ? `${enqueued} recording(s) queued for ingestion. Check the dashboard in a few minutes.`
        : errors.length > 0
          ? `No recordings could be queued. ${errors.join("; ")}`
          : "No recordings with downloadable files found.",
  });
}
