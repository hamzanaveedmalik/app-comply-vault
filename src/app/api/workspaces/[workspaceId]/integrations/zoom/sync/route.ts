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


type ZoomMeetingSummary = NonNullable<
  {
    meetings?: Array<{
      uuid?: string;
      id?: number;
      host_id?: string;
      topic?: string;
      start_time?: string;
      duration?: number;
    }>;
  }["meetings"]
>[number];

function parseZoomListError(body: string): { zoomCode?: number; zoomMessage?: string } {
  try {
    const j = JSON.parse(body) as { code?: number; message?: string };
    if (typeof j.message === "string") {
      return { zoomCode: typeof j.code === "number" ? j.code : undefined, zoomMessage: j.message };
    }
  } catch {
    /* plain-text body */
  }
  const trimmed = body.trim();
  if (trimmed.length > 0) {
    return { zoomMessage: trimmed.slice(0, 400) };
  }
  return {};
}

/** Zoom allows at most one calendar month per List recordings call — wider ranges return 400. */
function splitUtcIntoMonthChunks(fromYmd: string, toYmd: string): Array<{ from: string; to: string }> {
  const from = new Date(`${fromYmd}T00:00:00.000Z`);
  const to = new Date(`${toYmd}T23:59:59.999Z`);
  const ranges: Array<{ from: string; to: string }> = [];
  let cursor = new Date(from);
  while (cursor <= to) {
    const y = cursor.getUTCFullYear();
    const m = cursor.getUTCMonth();
    const lastOfMonthUtc = new Date(Date.UTC(y, m + 1, 0));
    const chunkEnd = lastOfMonthUtc < to ? lastOfMonthUtc : to;
    ranges.push({
      from: cursor.toISOString().slice(0, 10),
      to: chunkEnd.toISOString().slice(0, 10),
    });
    cursor = new Date(Date.UTC(y, m + 1, 1));
  }
  return ranges;
}

function recordingsListPath(userKey: string): string {
  return userKey === "me" ? "me" : encodeURIComponent(userKey);
}

async function listZoomMeetingsForRange(
  accessToken: string,
  accountEmail: string,
  fromYmd: string,
  toYmd: string
): Promise<{ meetings: ZoomMeetingSummary[]; zoomStatus?: number; zoomBody?: string }> {
  const userCandidates = ["me", accountEmail.trim()].filter(
    (v, i, a) => v.length > 0 && a.indexOf(v) === i
  );

  let lastFail: { zoomStatus: number; zoomBody: string } | undefined;

  for (const userKey of userCandidates) {
    const result = await listZoomMeetingsForUser(accessToken, userKey, fromYmd, toYmd);
    if (result.zoomStatus === undefined) {
      return result;
    }
    lastFail = { zoomStatus: result.zoomStatus, zoomBody: result.zoomBody ?? "" };
    console.error(
      `[Zoom sync] List recordings failed for userId=${userKey === "me" ? "me" : "(email)"}:`,
      result.zoomStatus,
      result.zoomBody
    );
    if (result.zoomStatus !== 400 && result.zoomStatus !== 404) {
      break;
    }
  }

  return {
    meetings: [],
    zoomStatus: lastFail?.zoomStatus,
    zoomBody: lastFail?.zoomBody,
  };
}

async function listZoomMeetingsForUser(
  accessToken: string,
  userKey: string,
  fromYmd: string,
  toYmd: string
): Promise<{ meetings: ZoomMeetingSummary[]; zoomStatus?: number; zoomBody?: string }> {
  const byKey = new Map<string, ZoomMeetingSummary>();
  const chunks = splitUtcIntoMonthChunks(fromYmd, toYmd);
  const pathSegment = recordingsListPath(userKey);

  for (const { from: chunkFrom, to: chunkTo } of chunks) {
    let nextPageToken = "";
    do {
      const params = new URLSearchParams({
        from: chunkFrom,
        to: chunkTo,
        page_size: "30",
      });
      if (nextPageToken) {
        params.set("next_page_token", nextPageToken);
      }
      const listUrl = `${ZOOM_API_BASE}/users/${pathSegment}/recordings?${params.toString()}`;
      const listRes = await fetch(listUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!listRes.ok) {
        const errText = await listRes.text();
        return { meetings: [], zoomStatus: listRes.status, zoomBody: errText };
      }

      const listData = (await listRes.json()) as {
        meetings?: ZoomMeetingSummary[];
        next_page_token?: string;
      };

      for (const m of listData.meetings ?? []) {
        const key = m.uuid ?? String(m.id ?? "");
        if (key) {
          byKey.set(key, m);
        }
      }
      nextPageToken = listData.next_page_token ?? "";
    } while (nextPageToken);
  }

  return { meetings: [...byKey.values()] };
}

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

  const to = new Date();
  const from = new Date(to);
  from.setUTCDate(from.getUTCDate() - 30);
  const fromStr = from.toISOString().slice(0, 10);
  const toStr = to.toISOString().slice(0, 10);

  const { meetings, zoomStatus, zoomBody } = await listZoomMeetingsForRange(
    accessToken,
    accountEmail,
    fromStr,
    toStr
  );

  if (zoomStatus !== undefined) {
    if (zoomStatus === 401) {
      return NextResponse.json(
        { error: "Zoom token expired. Please reconnect Zoom." },
        { status: 401 }
      );
    }
    if (zoomStatus === 403) {
      return NextResponse.json(
        {
          error:
            "Zoom account lacks cloud recording scopes. Reconnect Zoom and grant recording access.",
        },
        { status: 403 }
      );
    }
    const status = zoomStatus >= 400 && zoomStatus < 500 ? zoomStatus : 502;
    const parsed = zoomBody ? parseZoomListError(zoomBody) : {};
    return NextResponse.json(
      {
        error: `Zoom API error: ${zoomStatus}`,
        ...(parsed.zoomCode !== undefined ? { zoomCode: parsed.zoomCode } : {}),
        ...(parsed.zoomMessage ? { zoomMessage: parsed.zoomMessage } : {}),
        ...(zoomBody && !parsed.zoomMessage
          ? { detail: zoomBody.slice(0, 500) }
          : {}),
      },
      { status }
    );
  }

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
      downloadToken: String((downloadToken || files[0]?.download_token) ?? ""),
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
