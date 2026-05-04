/**
 * PATCH — set optional Zoho CRM Contact id for matching (Epic 3.0a)
 */

import { requireAppAccess } from "~/server/auth/guards";
import { db } from "~/server/db";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const bodySchema = z.object({
  zohoCrmContactId: z.string().max(200).nullable(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const access = await requireAppAccess();
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const { id: meetingId } = await params;
  const body = await request.json();
  const { zohoCrmContactId } = bodySchema.parse(body);

  const meeting = await db.meeting.findFirst({
    where: { id: meetingId, workspaceId: access.workspaceId },
  });
  if (!meeting) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (meeting.status === "FINALIZED") {
    return NextResponse.json({ error: "Meeting is read-only" }, { status: 403 });
  }

  await db.meeting.update({
    where: { id: meetingId },
    data: {
      zohoCrmContactId: zohoCrmContactId && zohoCrmContactId.trim() !== "" ? zohoCrmContactId.trim() : null,
      // allow re-file on next draft-ready
      zohoCrmNotePostedAt: null,
    },
  });

  await db.auditEvent.create({
    data: {
      workspaceId: access.workspaceId,
      userId: access.session.user.id,
      action: "EDIT",
      resourceType: "meeting",
      resourceId: meetingId,
      meetingId,
      metadata: {
        action: "zoho_crm_contact_id_set",
        hasContactId: Boolean(zohoCrmContactId),
      },
    },
  });

  return NextResponse.json({ success: true });
}
