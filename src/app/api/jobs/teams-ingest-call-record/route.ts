/**
 * POST /api/jobs/teams-ingest-call-record
 * Epic 1 Story 1.5: Teams call-record webhook path
 * Fetches call record (app token), resolves organizer, finds transcript, triggers teams-ingest
 */

import { db } from "~/server/db";
import { verifySignatureAppRouter } from "@upstash/qstash/nextjs";
import { z } from "zod";
import { decryptToken } from "~/server/integrations/crypto";
import { fetchCallRecord } from "~/server/integrations/teams-app-token";
import { publishTeamsIngestionJob } from "~/server/qstash";

const GRAPH_BASE = "https://graph.microsoft.com/v1.0";

const schema = z.object({
  callRecordId: z.string(),
});

export const maxDuration = 60;

async function listTranscriptsForOrganizer(
  accessToken: string,
  organizerId: string,
  startDateTime: string,
  endDateTime: string
): Promise<Array<{ id: string; meetingId: string; createdDateTime: string }>> {
  const fnParams = `meetingOrganizerUserId='${organizerId}',startDateTime=${startDateTime},endDateTime=${endDateTime}`;
  const url = `${GRAPH_BASE}/users/${encodeURIComponent(organizerId)}/onlineMeetings/getAllTranscripts(${fnParams})`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    throw new Error(`getAllTranscripts failed: ${res.status} ${res.statusText}`);
  }

  const data = (await res.json()) as {
    value?: Array<{
      id?: string;
      meetingId?: string;
      createdDateTime?: string;
    }>;
  };
  return (data.value ?? []).map((t) => ({
    id: t.id ?? "",
    meetingId: t.meetingId ?? "",
    createdDateTime: t.createdDateTime ?? "",
  }));
}

async function handler(request: Request) {
  try {
    const body = await request.json();
    const { callRecordId } = schema.parse(body);

    const callRecord = await fetchCallRecord(callRecordId);
    if (!callRecord) {
      return Response.json(
        { error: "Call record not found or inaccessible" },
        { status: 404 }
      );
    }

    const configs = await db.integrationConfig.findMany({
      where: { provider: "TEAMS" },
      include: { workspace: true },
    });
    const config = configs.find((c) => {
      const cfg = c.config as { organizerId?: string } | null;
      return cfg?.organizerId === callRecord.organizerId;
    });

    if (!config) {
      return Response.json(
        { error: "No workspace connected for this Teams organizer" },
        { status: 404 }
      );
    }

    const credential = await db.integrationCredential.findUnique({
      where: {
        workspaceId_provider: { workspaceId: config.workspaceId, provider: "TEAMS" },
      },
    });
    if (!credential) {
      return Response.json({ error: "Teams credential not found" }, { status: 404 });
    }

    const accessToken = decryptToken(credential.accessTokenEncrypted);

    const callEnd = new Date(callRecord.endDateTime);
    const callStart = new Date(callRecord.startDateTime);
    const startRange = new Date(callStart);
    startRange.setHours(startRange.getHours() - 1);
    const endRange = new Date(callEnd);
    endRange.setHours(endRange.getHours() + 2);

    const transcripts = await listTranscriptsForOrganizer(
      accessToken,
      callRecord.organizerId,
      startRange.toISOString(),
      endRange.toISOString()
    );

    if (transcripts.length === 0) {
      return Response.json({
        success: true,
        message: "No transcript found for this call yet (may be processing)",
      });
    }

    const sorted = transcripts.sort(
      (a, b) =>
        new Date(b.createdDateTime).getTime() - new Date(a.createdDateTime).getTime()
    );
    const best = sorted[0];
    if (!best?.id || !best?.meetingId) {
      return Response.json({
        success: true,
        message: "No valid transcript found for this call",
      });
    }

    const cfg = config.config as { accountEmail?: string } | null;
    const organiserEmail = cfg?.accountEmail ?? undefined;

    await publishTeamsIngestionJob({
      organizerId: callRecord.organizerId,
      meetingId: best.meetingId,
      transcriptId: best.id,
      organiserEmail,
    });

    return Response.json({
      success: true,
      messageId: "published",
      teamsMeetingId: best.meetingId,
    });
  } catch (error) {
    console.error("Teams call-record ingestion error:", error);
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
