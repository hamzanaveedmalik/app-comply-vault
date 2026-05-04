/**
 * POST /api/jobs/teams-ingest
 * Epic 1 Story 1.5: Teams transcript ingestion
 * Fetches transcript from Graph API, runs extraction pipeline
 */

import { db } from "~/server/db";
import { verifySignatureAppRouter } from "@upstash/qstash/nextjs";
import { z } from "zod";
import { decryptToken } from "~/server/integrations/crypto";

const GRAPH_BASE = "https://graph.microsoft.com/v1.0";

const teamsIngestSchema = z.object({
  organizerId: z.string(),
  meetingId: z.string(),
  transcriptId: z.string(),
  organiserEmail: z.string().optional(),
});

export const maxDuration = 120;

async function fetchTranscriptContent(
  accessToken: string,
  organizerId: string,
  meetingId: string,
  transcriptId: string
): Promise<string> {
  const url = `${GRAPH_BASE}/users/${encodeURIComponent(organizerId)}/onlineMeetings/${encodeURIComponent(meetingId)}/transcripts/${encodeURIComponent(transcriptId)}/content?$format=text/vtt`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    throw new Error(`Graph transcript fetch failed: ${res.status} ${res.statusText}`);
  }

  return res.text();
}

function parseVttToSegments(
  vtt: string
): Array<{ startTime: number; endTime: number; speaker: string; text: string }> {
  const segments: Array<{ startTime: number; endTime: number; speaker: string; text: string }> = [];
  const lines = vtt.split(/\r?\n/);
  let i = 0;

  while (i < lines.length) {
    const line = lines[i] ?? "";
    const timeMatch = line.match(
      /^(\d{2}):(\d{2}):(\d{2})\.(\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})\.(\d{3})/
    );
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

      const text = textLines.join(" ").replace(/<\/v>/g, "");
      const speakerMatch = text.match(/<v ([^>]+)>(.+)/);
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

async function handler(request: Request) {
  try {
    const body = await request.json();
    const payload = teamsIngestSchema.parse(body);

    const configs = await db.integrationConfig.findMany({
      where: { provider: "TEAMS" },
      include: { workspace: true },
    });
    const config = configs.find((c) => {
      const cfg = c.config as { organizerId?: string } | null;
      return cfg?.organizerId === payload.organizerId;
    });

    if (!config) {
      return Response.json(
        { error: "No workspace connected for this Teams organizer" },
        { status: 404 }
      );
    }

    const workspaceId = config.workspaceId;
    const credential = await db.integrationCredential.findUnique({
      where: {
        workspaceId_provider: { workspaceId, provider: "TEAMS" },
      },
    });

    if (!credential) {
      return Response.json({ error: "Teams credential not found" }, { status: 404 });
    }

    const accessToken = decryptToken(credential.accessTokenEncrypted);
    const vttText = await fetchTranscriptContent(
      accessToken,
      payload.organizerId,
      payload.meetingId,
      payload.transcriptId
    );

    const segments = parseVttToSegments(vttText);
    if (segments.length === 0) {
      return Response.json(
        { error: "No transcript segments parsed" },
        { status: 400 }
      );
    }

    const transcript = { segments, duration: segments.at(-1)?.endTime ?? 0 };
    const meetingDate = new Date();
    const clientName = `Teams meeting ${payload.meetingId.slice(0, 12)}`;
    const meetingType = "Teams recording";

    const meeting = await db.meeting.create({
      data: {
        workspaceId,
        clientName,
        meetingType,
        meetingDate,
        status: "PROCESSING",
        transcript: transcript as object,
        sourceFileName: "teams-transcript.vtt",
        sourceFileMime: "text/vtt",
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
          action: "teams_ingestion_started",
          teamsMeetingId: payload.meetingId,
          organiserEmail: payload.organiserEmail,
        },
      },
    });

    const { extractFields } = await import("~/server/extraction");
    const { toExtractionData } = await import("~/server/extraction/evidence");
    const { generateSearchableText } = await import("~/server/search/index");
    const { detectMissingDisclosureFlags } = await import("~/server/flags");

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

    const missingDisclosureFlags = detectMissingDisclosureFlags(extractionData);
    if (missingDisclosureFlags.length > 0) {
      await db.flag.createMany({
        data: missingDisclosureFlags.map((flag) => ({
          workspaceId,
          meetingId: meeting.id,
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
          action: "teams_ingestion_complete",
          teamsMeetingId: payload.meetingId,
          organiserEmail: payload.organiserEmail,
        },
      },
    });

    try {
      const { sendDraftReadyEmail } = await import("~/server/email");
      const owner = await db.userWorkspace.findFirst({
        where: { workspaceId, role: "OWNER_CCO" },
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
    });
  } catch (error) {
    console.error("Teams ingestion error:", error);
    if (error instanceof z.ZodError) {
      return Response.json({ error: "Invalid payload", details: error.errors }, { status: 400 });
    }
    return Response.json(
      { error: error instanceof Error ? error.message : "Ingestion failed" },
      { status: 500 }
    );
  }
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
