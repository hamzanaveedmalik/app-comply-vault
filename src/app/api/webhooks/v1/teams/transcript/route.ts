/**
 * POST /api/webhooks/v1/teams/transcript
 * Epic 1 Story 1.5: Microsoft Graph transcript change notification
 * Subscribed to users/{organizerId}/onlineMeetings/getAllTranscripts
 */

import { NextRequest, NextResponse } from "next/server";
import { publishTeamsIngestionJob } from "~/server/qstash";
import { db } from "~/server/db";

const CLIENT_STATE = process.env.TEAMS_WEBHOOK_CLIENT_STATE ?? "complyvault";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;

  if (body.validationToken) {
    return new NextResponse(body.validationToken as string, {
      headers: { "Content-Type": "text/plain" },
    });
  }

  const clientState = body.clientState as string | undefined;
  if (clientState !== CLIENT_STATE) {
    return new NextResponse("Invalid client state", { status: 401 });
  }

  const value = body.value as Array<{
    resource?: string;
    resourceData?: { id?: string; meetingId?: string };
  }> | undefined;

  if (!Array.isArray(value) || value.length === 0) {
    return NextResponse.json({ received: true });
  }

  for (const notif of value) {
    const resource = notif.resource ?? "";
    if (!resource.includes("transcripts")) continue;

    const match = resource.match(
      /users\('([^']+)'\)\/onlineMeetings\('([^']+)'\)\/transcripts\('([^']+)'\)/
    );
    if (!match) continue;

    const [, organizerId, meetingId, transcriptId] = match;
    if (!organizerId || !meetingId || !transcriptId) continue;

    const configs = await db.integrationConfig.findMany({
      where: { provider: "TEAMS" },
      include: { workspace: true },
    });
    const config = configs.find((c) => {
      const cfg = c.config as { organizerId?: string } | null;
      return cfg?.organizerId === organizerId;
    });

    if (!config) continue;

    const cfg = config.config as { accountEmail?: string } | null;
    const organiserEmail = cfg?.accountEmail ?? undefined;

    try {
      await publishTeamsIngestionJob({
        organizerId,
        meetingId,
        transcriptId,
        organiserEmail,
      });
    } catch (err) {
      console.error("[Teams transcript webhook] Failed to enqueue:", err);
    }
  }

  return NextResponse.json({ received: true });
}
