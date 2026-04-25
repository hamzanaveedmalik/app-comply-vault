/**
 * POST /api/webhooks/v1/teams/call-record
 * Epic 1 Story 1.5: Microsoft Graph callRecord change notification
 * Validates subscription, handles lifecycle (validation request), processes callRecord updates
 * Requires tenant-wide subscription to communications/callRecords (CallRecords.Read.All app permission)
 */

import { NextRequest, NextResponse } from "next/server";
import { publishTeamsCallRecordJob } from "~/server/qstash";

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

  const value = body.value as Array<{ resource?: string; resourceData?: { id?: string } }> | undefined;
  if (!Array.isArray(value) || value.length === 0) {
    return NextResponse.json({ received: true });
  }

  for (const notif of value) {
    if (notif.resource?.includes("callRecords") && notif.resourceData?.id) {
      try {
        await publishTeamsCallRecordJob({ callRecordId: notif.resourceData.id });
      } catch (err) {
        console.error("[Teams call-record webhook] Failed to enqueue:", err);
      }
    }
  }

  return NextResponse.json({ received: true });
}
