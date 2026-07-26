import { requireAppAccess } from "~/server/auth/guards";
import { db } from "~/server/db";
import { isCcoActor } from "~/lib/meeting-workflow";
import { z } from "zod";
import type { MeetingStatus } from "../../../../../../generated/prisma";
import { Prisma } from "../../../../../../generated/prisma";

export const runtime = "nodejs";

const bodySchema = z.object({
  revertTo: z.enum(["ADVISOR_CERTIFIED", "CM_REVIEWED"]),
  reason: z.string().min(10, "Reason required"),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  try {
    const access = await requireAppAccess();
    if (!access.ok) {
      return Response.json({ success: false, error: access.error }, { status: access.status });
    }
    const { session, workspaceId } = access;

    if (!isCcoActor(session.user.role)) {
      return Response.json({ success: false, error: "Only the CCO can revert workflow" }, { status: 403 });
    }

    const { id } = await params;
    const { revertTo, reason } = bodySchema.parse(await request.json());

    const meeting = await db.meeting.findFirst({
      where: { id, workspaceId },
    });
    if (!meeting) {
      return Response.json({ success: false, error: "Meeting not found" }, { status: 404 });
    }

    const { assertSupersessionAllowsMutation } = await import(
      "~/server/meetings/supersession-guards"
    );
    const chainGate = assertSupersessionAllowsMutation(meeting);
    if (!chainGate.ok) {
      return Response.json(
        { success: false, error: chainGate.error },
        { status: chainGate.status },
      );
    }

    const order: MeetingStatus[] = [
      "ADVISOR_CERTIFIED",
      "CM_REVIEWED",
      "CCO_SIGNED_OFF",
      "FINALIZED",
    ];

    const currentIdx = order.indexOf(meeting.status as MeetingStatus);
    const targetIdx = order.indexOf(revertTo as MeetingStatus);

    if (currentIdx === -1 || targetIdx === -1) {
      return Response.json(
        { success: false, error: "This meeting status cannot be reverted via this action" },
        { status: 400 }
      );
    }

    if (meeting.status === "FINALIZED") {
      return Response.json(
        { success: false, error: "Finalized meetings cannot be reverted" },
        { status: 400 }
      );
    }

    if (targetIdx >= currentIdx) {
      return Response.json(
        { success: false, error: "Can only revert to an earlier workflow stage" },
        { status: 400 }
      );
    }

    const data =
      revertTo === "ADVISOR_CERTIFIED"
        ? {
            status: "ADVISOR_CERTIFIED" as const,
            cmReviewedAt: null,
            cmReviewedByUserId: null,
            cmReviewSummary: Prisma.JsonNull,
            ccoSignedOffAt: null,
            ccoSignedOffByUserId: null,
          }
        : {
            status: "CM_REVIEWED" as const,
            ccoSignedOffAt: null,
            ccoSignedOffByUserId: null,
          };

    const updated = await db.$transaction(async (tx) => {
      const m = await tx.meeting.update({
        where: { id },
        data,
      });

      await tx.auditEvent.create({
        data: {
          workspaceId,
          userId: session.user.id,
          action: "WORKFLOW_REVERTED",
          resourceType: "meeting",
          resourceId: meeting.id,
          meetingId: meeting.id,
          metadata: {
            revertTo,
            reason,
            previousStatus: meeting.status,
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
          whatChanged: `workflow reverted to ${revertTo}`,
          reason,
        },
      });

      return m;
    });

    return Response.json({
      success: true,
      data: {
        meeting: { id: updated.id, status: updated.status },
      },
    });
  } catch (e) {
    console.error("revert-workflow:", e);
    if (e instanceof z.ZodError) {
      return Response.json({ success: false, error: "Invalid body", details: e.errors }, { status: 400 });
    }
    return Response.json(
      { success: false, error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}
