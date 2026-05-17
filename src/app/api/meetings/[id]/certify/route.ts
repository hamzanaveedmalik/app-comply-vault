import { requireAppAccess } from "~/server/auth/guards";
import { db } from "~/server/db";
import {
  isAdvisorActor,
  meetingAllowsAdvisorCertify,
} from "~/lib/meeting-workflow";

export const runtime = "nodejs";

const ATTESTATION =
  "I confirm that this meeting record accurately reflects the discussion that took place. Any corrections have been made above.";

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

    if (!isAdvisorActor(session.user.role)) {
      return Response.json(
        { success: false, error: "Only advisor or owner can certify meeting accuracy" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const meeting = await db.meeting.findFirst({
      where: { id, workspaceId },
    });
    if (!meeting) {
      return Response.json({ success: false, error: "Meeting not found" }, { status: 404 });
    }

    if (!meetingAllowsAdvisorCertify(meeting.status)) {
      return Response.json(
        {
          success: false,
          error: `Meeting must be DRAFT_READY to certify. Current status: ${meeting.status}`,
        },
        { status: 400 }
      );
    }

    const ipAddress =
      _request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      _request.headers.get("x-real-ip") ??
      undefined;

    const now = new Date();
    const updated = await db.$transaction(async (tx) => {
      const m = await tx.meeting.update({
        where: { id },
        data: {
          status: "ADVISOR_CERTIFIED",
          advisorCertifiedAt: now,
          advisorCertifiedByUserId: session.user.id,
        },
      });

      await tx.auditEvent.create({
        data: {
          workspaceId,
          userId: session.user.id,
          action: "ADVISOR_CERTIFIED",
          resourceType: "meeting",
          resourceId: meeting.id,
          meetingId: meeting.id,
          metadata: {
            attestation: ATTESTATION,
            ipAddress,
            certifiedAt: now.toISOString(),
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
          whatChanged: "workflow: advisor certified transcript accuracy",
          reason: "ADVISOR_CERTIFIED",
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
          advisorCertifiedAt: updated.advisorCertifiedAt?.toISOString() ?? null,
        },
      },
    });
  } catch (e) {
    console.error("certify meeting:", e);
    return Response.json(
      { success: false, error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}
