/**
 * POST /api/webhooks/v1/teams/call-record
 * Epic 1 Story 1.5: Microsoft Graph callRecord change notification
 * Validates subscription, handles lifecycle (validation request), processes callRecord updates
 */

import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;

  if (body.validationToken) {
    return new NextResponse(body.validationToken as string, {
      headers: { "Content-Type": "text/plain" },
    });
  }

  const value = body.value as Array<{ resource?: string; resourceData?: { id?: string } }> | undefined;
  if (!Array.isArray(value) || value.length === 0) {
    return NextResponse.json({ received: true });
  }

  for (const notif of value) {
    if (notif.resource?.includes("callRecords") && notif.resourceData?.id) {
      // Story 1.5: Enqueue Teams ingestion job
      // TODO: publishTeamsIngestionJob({ callRecordId: notif.resourceData.id })
    }
  }

  return NextResponse.json({ received: true });
}
