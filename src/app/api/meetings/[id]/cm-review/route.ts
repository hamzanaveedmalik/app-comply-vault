import { requireAppAccess } from "~/server/auth/guards";
import { db } from "~/server/db";
import {
  flagIsCmTriaged,
  isComplianceActor,
  meetingAllowsCmComplete,
} from "~/lib/meeting-workflow";

export const runtime = "nodejs";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  try {
    const access = await requireAppAccess();
    if (!access.ok) {
      return Response.json({ success: false, error: access.error }, { status: access.status });
    }
    const { session, workspaceId } = access;

    if (!isComplianceActor(session.user.role)) {
      return Response.json(
        { success: false, error: "Only compliance manager or owner can complete CM review" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const meeting = await db.meeting.findFirst({
      where: { id, workspaceId },
      include: {
        flags: true,
      },
    });

    if (!meeting) {
      return Response.json({ success: false, error: "Meeting not found" }, { status: 404 });
    }

    if (!meetingAllowsCmComplete(meeting.status)) {
      return Response.json(
        {
          success: false,
          error: `Meeting must be ADVISOR_CERTIFIED. Current: ${meeting.status}`,
        },
        { status: 400 }
      );
    }

    const untriaged = meeting.flags.filter((f) => !flagIsCmTriaged(f));
    if (untriaged.length > 0) {
      return Response.json(
        {
          success: false,
          error: `All flags must be triaged before completing review (${untriaged.length} remaining)`,
        },
        { status: 400 }
      );
    }

    let resolved = 0;
    let noted = 0;
    let escalated = 0;
    for (const f of meeting.flags) {
      if (f.cmDisposition === "RESOLVED" || f.status === "CLOSED" || f.status === "CLOSED_ACCEPTED_RISK") {
        resolved += 1;
      } else if (f.cmDisposition === "NOTED") {
        noted += 1;
      } else if (f.cmDisposition === "ESCALATED" || f.status === "PENDING_VERIFICATION") {
        escalated += 1;
      }
    }

    const escalatedCount = meeting.flags.filter((f) => f.status === "PENDING_VERIFICATION").length;

    const now = new Date();
    const updated = await db.$transaction(async (tx) => {
      const m = await tx.meeting.update({
        where: { id },
        data: {
          status: "CM_REVIEWED",
          cmReviewedAt: now,
          cmReviewedByUserId: session.user.id,
          cmReviewSummary: { resolved, noted, escalated },
        },
      });

      await tx.auditEvent.create({
        data: {
          workspaceId,
          userId: session.user.id,
          action: "CM_REVIEW_COMPLETED",
          resourceType: "meeting",
          resourceId: meeting.id,
          meetingId: meeting.id,
          metadata: {
            resolved,
            noted,
            escalated,
            escalatedCount,
            completedAt: now.toISOString(),
          },
        },
      });

      const nextVersion = ((await tx.version.findFirst({
        where: { meetingId: meeting.id },
        orderBy: { version: "desc" },
      }))?.version ?? 0) + 1;

      await tx.version.create({
        data: {
          meetingId: meeting.id,
          version: nextVersion,
          editorId: session.user.id,
          whatChanged: "workflow: compliance manager completed flag review",
          reason: "CM_REVIEW_COMPLETED",
        },
      });

      return m;
    });

    return Response.json({
      success: true,
      data: {
        meeting: {
          id: updated.id,
          status: updated.status,
          cmReviewedAt: updated.cmReviewedAt?.toISOString() ?? null,
        },
        escalatedCount,
      },
    });
  } catch (e) {
    console.error("cm-review:", e);
    return Response.json(
      { success: false, error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}
