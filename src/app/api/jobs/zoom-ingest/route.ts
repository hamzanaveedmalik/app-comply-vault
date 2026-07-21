/**
 * POST /api/jobs/zoom-ingest
 * Epic 1 Story 1.2a/1.2b: Zoom recording ingestion
 * Called by QStash when recording.completed webhook triggers ingestion
 *
 * Flow: Find workspace by hostEmail → Create meeting → Download from Zoom → Upload to S3 → Publish process-meeting
 */

import { db } from "~/server/db";
import { uploadFile } from "~/server/storage";
import { publishProcessMeetingJob } from "~/server/qstash";
import { verifySignatureAppRouter } from "@upstash/qstash/nextjs";
import { z } from "zod";
import { activeUserWorkspaceWhere } from "~/lib/user-workspace-filters";

const zoomIngestSchema = z.object({
  zoomMeetingId: z.string(),
  zoomMeetingNumericId: z.string().optional(),
  hostEmail: z.string().email(),
  topic: z.string().optional(),
  startTime: z.string().optional(),
  duration: z.number().optional(),
  downloadToken: z.string(),
  recordingFiles: z.array(
    z.object({
      id: z.string().optional(),
      fileType: z.string().optional(),
      fileExtension: z.string().optional(),
      downloadUrl: z.string().optional(),
      downloadToken: z.string().optional(),
      status: z.string().optional(),
    })
  ),
});

export const maxDuration = 120;

async function checkExternalParticipants(
  workspaceId: string,
  meetingId: string,
  hostEmail: string
): Promise<boolean> {
  try {
    const credential = await db.integrationCredential.findUnique({
      where: { workspaceId_provider: { workspaceId, provider: "ZOOM" } },
    });
    if (!credential) return true;

    const { decryptToken } = await import("~/server/integrations/crypto");
    const accessToken = decryptToken(credential.accessTokenEncrypted);

    const hostDomain = hostEmail.split("@")[1]?.toLowerCase() ?? "";
    const res = await fetch(
      `https://api.zoom.us/v2/report/meetings/${encodeURIComponent(meetingId)}/participants?page_size=300`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!res.ok) {
      if (res.status === 403) return true;
      return true;
    }

    const data = (await res.json()) as { participants?: Array<{ user_email?: string }> };
    const participants = data.participants ?? [];
    const hasExternal = participants.some((p) => {
      const email = p.user_email ?? "";
      const domain = email.split("@")[1]?.toLowerCase() ?? "";
      return domain && domain !== hostDomain;
    });
    return hasExternal;
  } catch {
    return true;
  }
}

async function downloadFromZoom(
  downloadUrl: string,
  token: string
): Promise<{ buffer: Buffer; contentType: string }> {
  const res = await fetch(downloadUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    throw new Error(`Zoom download failed: ${res.status} ${res.statusText}`);
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  const contentType = res.headers.get("content-type") ?? "video/mp4";
  return { buffer, contentType };
}

async function handler(request: Request) {
  try {
    const body = await request.json();
    const payload = zoomIngestSchema.parse(body);

    // Find workspace by host email (Zoom account connected to workspace)
    const configs = await db.integrationConfig.findMany({
      where: { provider: "ZOOM" },
      include: { workspace: true },
    });

    const config = configs.find((c) => {
      const cfg = c.config as { accountEmail?: string; recordingScope?: string } | null;
      return cfg?.accountEmail?.toLowerCase() === payload.hostEmail.toLowerCase();
    });

    if (!config) {
      console.warn(`No workspace found for Zoom host: ${payload.hostEmail}`);
      return Response.json(
        { error: "No workspace connected for this Zoom account" },
        { status: 404 }
      );
    }

    const workspaceId = config.workspaceId;
    const recordingScope = (config.config as { recordingScope?: string } | null)?.recordingScope ?? "all";

    if (recordingScope === "external_only") {
      const hasExternal = await checkExternalParticipants(
        workspaceId,
        payload.zoomMeetingNumericId ?? payload.zoomMeetingId,
        payload.hostEmail
      );
      if (!hasExternal) {
        await db.auditEvent.create({
          data: {
            workspaceId,
            userId: "system",
            action: "UPLOAD",
            resourceType: "meeting",
            resourceId: `zoom-skip-${payload.zoomMeetingId}`,
            metadata: {
              action: "zoom_ingestion_skipped_scope",
              zoomMeetingId: payload.zoomMeetingId,
              reason: "external_only_scope_no_external_participants",
            },
          },
        });
        return Response.json({
          success: true,
          skipped: true,
          reason: "external_only_scope",
        });
      }
    }

    // Prefer VTT transcript, then MP4/M4A
    const transcriptFile = payload.recordingFiles.find(
      (f) =>
        (f.fileType ?? f.fileExtension ?? "").toUpperCase() === "VTT" ||
        (f.fileType ?? f.fileExtension ?? "").toUpperCase() === "TRANSCRIPT"
    );
    const mediaFile =
      payload.recordingFiles.find(
        (f) =>
          ["MP4", "M4A"].includes((f.fileType ?? f.fileExtension ?? "").toUpperCase()) &&
          (f.downloadUrl ?? f.downloadToken)
      ) ?? payload.recordingFiles[0];

    if (!mediaFile?.downloadUrl && !transcriptFile?.downloadUrl) {
      return Response.json(
        { error: "No downloadable recording or transcript in webhook payload" },
        { status: 400 }
      );
    }

    const meetingDate = payload.startTime
      ? new Date(payload.startTime)
      : new Date();
    const clientName = payload.topic ?? `Zoom meeting ${payload.zoomMeetingId.slice(0, 8)}`;
    const meetingType = "Zoom recording";

    const meeting = await db.meeting.create({
      data: {
        workspaceId,
        clientName,
        meetingType,
        meetingDate,
        status: "PROCESSING",
        sourceFileName: `zoom-${payload.zoomMeetingId}.mp4`,
        sourceUploadedAt: new Date(),
      },
    });

    await db.auditEvent.create({
      data: {
        workspaceId,
        userId: "system",
        action: "UPLOAD",
        resourceType: "meeting",
        resourceId: meeting.id,
        meetingId: meeting.id,
        metadata: {
          action: "zoom_ingestion_started",
          zoomMeetingId: payload.zoomMeetingId,
          hostEmail: payload.hostEmail,
        },
      },
    });

    if (transcriptFile?.downloadUrl) {
      const token =
        transcriptFile.downloadToken ?? payload.downloadToken;
      const { buffer } = await downloadFromZoom(transcriptFile.downloadUrl, token);
      const vttText = buffer.toString("utf-8");

      // Parse VTT to transcript format (simple: lines with timestamps)
      const segments = parseVttToSegments(vttText);
      if (segments.length > 0) {
        await db.meeting.update({
          where: { id: meeting.id },
          data: {
            transcript: { segments, duration: segments.at(-1)?.endTime ?? 0 },
            sourceFileName: "zoom-transcript.vtt",
            sourceFileMime: "text/vtt",
          },
        });

        const { extractFields } = await import("~/server/extraction");
        const { toExtractionData, validateEvidenceCoverage } = await import(
          "~/server/extraction/evidence"
        );
        const { generateSearchableText } = await import("~/server/search/index");
        const { detectMissingDisclosureFlags } = await import("~/server/flags");

        const transcript = { segments };
        const extractionResult = await extractFields(transcript);
        const extractionData = toExtractionData(extractionResult, transcript);
        const searchableText = generateSearchableText(transcript, extractionData);

        await db.meeting.update({
          where: { id: meeting.id },
          data: {
            extraction: extractionData as object,
            searchableText,
            status: "DRAFT_READY",
            draftReadyAt: new Date(),
          },
        });

        const { getDisclosureProfileForWorkspace } = await import(
          "~/server/firm-profile/get-disclosure-profile-for-workspace"
        );
        const disclosureProfile = await getDisclosureProfileForWorkspace(workspaceId);
        const missingDisclosureFlags = detectMissingDisclosureFlags(extractionData, {
          profile: disclosureProfile,
        });
        if (missingDisclosureFlags.length > 0) {
          await db.flag.createMany({
            data: missingDisclosureFlags.map((flag) => ({
              workspaceId,
              meetingId: meeting.id,
              sourceType: "MEETING",
              sourceId: meeting.id,
              type: flag.type,
              severity: flag.severity,
              status: "OPEN",
              evidence: flag.evidence as object,
              createdByType: "SYSTEM",
            })),
          });
        }

        await db.auditEvent.create({
          data: {
            workspaceId,
            userId: "system",
            action: "UPLOAD",
            resourceType: "meeting",
            resourceId: meeting.id,
            meetingId: meeting.id,
            metadata: {
              action: "zoom_ingestion_complete_vtt",
              zoomMeetingId: payload.zoomMeetingId,
            },
          },
        });

        try {
          const { sendDraftReadyEmail } = await import("~/server/email");
          const owner = await db.userWorkspace.findFirst({
            where: { workspaceId, role: "OWNER_CCO", ...activeUserWorkspaceWhere },
            include: { user: true },
          });
          if (owner?.user?.email) {
            sendDraftReadyEmail({
              email: owner.user.email,
              clientName: meeting.clientName,
              meetingDate: meeting.meetingDate,
              meetingId: meeting.id,
            }).catch((e) => console.error("Draft ready email failed:", e));
          }
        } catch {
          // Ignore email errors
        }

        try {
          const { enqueueZohoCrmNoteIfConnected } = await import(
            "~/server/integrations/zoho/enqueue-note"
          );
          void enqueueZohoCrmNoteIfConnected(workspaceId, meeting.id);
        } catch {
          // non-blocking
        }

        return Response.json({
          success: true,
          meetingId: meeting.id,
          status: "DRAFT_READY",
          source: "vtt_transcript",
        });
      }
    }

    if (mediaFile?.downloadUrl) {
      const token = mediaFile.downloadToken ?? payload.downloadToken;
      const { buffer, contentType } = await downloadFromZoom(
        mediaFile.downloadUrl,
        token
      );

      const ext = (mediaFile.fileExtension ?? mediaFile.fileType ?? "mp4").toLowerCase();
      const filename = `recording.${ext}`;

      const { key } = await uploadFile(
        workspaceId,
        meeting.id,
        buffer,
        filename,
        contentType
      );

      await db.meeting.update({
        where: { id: meeting.id },
        data: {
          fileUrl: key,
          sourceFileName: filename,
          sourceFileMime: contentType,
        },
      });

      await publishProcessMeetingJob({
        meetingId: meeting.id,
        workspaceId,
        fileUrl: key,
      });

      await db.auditEvent.create({
        data: {
          workspaceId,
          userId: "system",
          action: "UPLOAD",
          resourceType: "meeting",
          resourceId: meeting.id,
          meetingId: meeting.id,
          metadata: {
            action: "zoom_ingestion_complete_media",
            zoomMeetingId: payload.zoomMeetingId,
            fileKey: key,
          },
        },
      });

      return Response.json({
        success: true,
        meetingId: meeting.id,
        status: "PROCESSING",
        source: "media_file",
      });
    }

    await db.meeting.update({
      where: { id: meeting.id },
      data: { status: "UPLOADING" },
    });

    return Response.json(
      { error: "No valid recording or transcript to process" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Zoom ingestion error:", error);
    if (error instanceof z.ZodError) {
      return Response.json({ error: "Invalid payload", details: error.errors }, { status: 400 });
    }
    return Response.json(
      { error: error instanceof Error ? error.message : "Ingestion failed" },
      { status: 500 }
    );
  }
}

function parseVttToSegments(vtt: string): Array<{ startTime: number; endTime: number; speaker: string; text: string }> {
  const segments: Array<{ startTime: number; endTime: number; speaker: string; text: string }> = [];
  const lines = vtt.split(/\r?\n/);
  let i = 0;

  while (i < lines.length) {
    const line = lines[i] ?? "";
    const timeMatch = line.match(/^(\d{2}):(\d{2}):(\d{2})\.(\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})\.(\d{3})/);
    if (timeMatch) {
      const startTime =
        parseInt(timeMatch[1]!, 10) * 3600 +
        parseInt(timeMatch[2]!, 10) * 60 +
        parseInt(timeMatch[3]!, 10) +
        parseInt(timeMatch[4]!, 10) / 1000;
      const endTime =
        parseInt(timeMatch[5]!, 10) * 3600 +
        parseInt(timeMatch[6]!, 10) * 60 +
        parseInt(timeMatch[7]!, 10) +
        parseInt(timeMatch[8]!, 10) / 1000;

      i++;
      const textLines: string[] = [];
      while (i < lines.length && lines[i]?.trim()) {
        textLines.push(lines[i]!.trim());
        i++;
      }

      const text = textLines.join(" ");
      const speakerMatch = text.match(/^([^:]+):\s*(.+)$/);
      const speaker = speakerMatch ? speakerMatch[1]!.trim() : "Speaker 1";
      const content = speakerMatch ? speakerMatch[2]!.trim() : text;

      if (content) {
        segments.push({ startTime, endTime, speaker, text: content });
      }
    }
    i++;
  }

  return segments;
}

const isProduction = process.env.NODE_ENV === "production";
const hasSigningKeys = !!(
  process.env.QSTASH_CURRENT_SIGNING_KEY || process.env.QSTASH_NEXT_SIGNING_KEY
);

export const POST =
  isProduction && hasSigningKeys
    ? (() => {
        try {
          return verifySignatureAppRouter(handler);
        } catch {
          return handler;
        }
      })()
    : handler;
