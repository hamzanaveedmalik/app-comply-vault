import { requireAppAccess } from "~/server/auth/guards";
import { db } from "~/server/db";
import { z } from "zod";
import {
  isComplianceActor,
  meetingAllowsCmTriage,
} from "~/lib/meeting-workflow";

export const runtime = "nodejs";

const triageSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("resolve"),
    resolutionNote: z.string().min(10, "Resolution note required"),
  }),
  z.object({
    action: z.literal("note"),
    cmTriageNote: z.string().min(5, "Note required"),
  }),
  z.object({
    action: z.literal("escalate"),
    escalationReason: z.string().min(10, "Escalation reason required"),
  }),
]);

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

    if (!isComplianceActor(session.user.role)) {
      return Response.json(
        { success: false, error: "Only compliance manager or owner can triage flags" },
        { status: 403 }
      );
    }

    const { id: flagId } = await params;
    const body = triageSchema.parse(await request.json());

    const flag = await db.flag.findFirst({
      where: { id: flagId, workspaceId },
      include: { resolutionRecord: true },
    });

    if (!flag) {
      return Response.json({ success: false, error: "Flag not found" }, { status: 404 });
    }

    const meeting = await db.meeting.findFirst({
      where: { id: flag.meetingId, workspaceId },
    });
    if (!meeting || !meetingAllowsCmTriage(meeting.status)) {
      return Response.json(
        {
          success: false,
          error: "CM triage is only allowed when the meeting is ADVISOR_CERTIFIED",
        },
        { status: 400 }
      );
    }

    if (flag.cmDisposition !== "NONE") {
      return Response.json(
        { success: false, error: "This flag has already been triaged" },
        { status: 400 }
      );
    }

    if (flag.status !== "OPEN") {
      return Response.json(
        {
          success: false,
          error: "Only open flags can use quick triage; use remediation for in-progress items",
        },
        { status: 400 }
      );
    }

    if (flag.resolutionRecord) {
      return Response.json(
        { success: false, error: "Flag already has a remediation record; use remediation workflow" },
        { status: 400 }
      );
    }

    const now = new Date();

    if (body.action === "resolve") {
      const updated = await db.$transaction(async (tx) => {
        const f = await tx.flag.update({
          where: { id: flagId },
          data: {
            status: "CLOSED",
            resolutionType: "DISMISSED_WITH_REASON",
            resolutionNote: body.resolutionNote,
            resolvedAt: now,
            resolvedByUserId: session.user.id,
            cmDisposition: "RESOLVED",
            cmTriagedAt: now,
            cmTriagedByUserId: session.user.id,
          },
        });
        await tx.auditEvent.create({
          data: {
            workspaceId,
            userId: session.user.id,
            action: "REMEDIATION_UPDATE",
            resourceType: "flag",
            resourceId: flag.id,
            meetingId: meeting.id,
            metadata: { cmTriage: "resolve", flagId: flag.id },
          },
        });
        return f;
      });
      return Response.json({ success: true, data: { flag: { id: updated.id, status: updated.status } } });
    }

    if (body.action === "note") {
      const updated = await db.$transaction(async (tx) => {
        const f = await tx.flag.update({
          where: { id: flagId },
          data: {
            cmDisposition: "NOTED",
            cmTriageNote: body.cmTriageNote,
            cmTriagedAt: now,
            cmTriagedByUserId: session.user.id,
          },
        });
        await tx.auditEvent.create({
          data: {
            workspaceId,
            userId: session.user.id,
            action: "REMEDIATION_UPDATE",
            resourceType: "flag",
            resourceId: flag.id,
            meetingId: meeting.id,
            metadata: { cmTriage: "note", flagId: flag.id },
          },
        });
        return f;
      });
      return Response.json({ success: true, data: { flag: { id: updated.id, status: updated.status } } });
    }

    // escalate
    const updated = await db.$transaction(async (tx) => {
      const rr = await tx.resolutionRecord.create({
        data: {
          workspaceId: flag.workspaceId,
          meetingId: flag.meetingId,
          flagId: flag.id,
          resolutionType: "DISMISSED_WITH_REASON",
          rationale: body.escalationReason,
          createdByUserId: session.user.id,
          submittedForVerificationAt: now,
          metadata: { cmEscalation: true },
        },
      });

      const f = await tx.flag.update({
        where: { id: flagId },
        data: {
          status: "PENDING_VERIFICATION",
          cmDisposition: "ESCALATED",
          escalationReason: body.escalationReason,
          cmTriagedAt: now,
          cmTriagedByUserId: session.user.id,
        },
      });

      await tx.auditEvent.create({
        data: {
          workspaceId,
          userId: session.user.id,
          action: "REMEDIATION_START",
          resourceType: "flag",
          resourceId: flag.id,
          meetingId: meeting.id,
          metadata: {
            cmTriage: "escalate",
            flagId: flag.id,
            resolutionRecordId: rr.id,
          },
        },
      });

      return f;
    });

    return Response.json({ success: true, data: { flag: { id: updated.id, status: updated.status } } });
  } catch (e) {
    console.error("cm-triage:", e);
    if (e instanceof z.ZodError) {
      return Response.json({ success: false, error: "Invalid input", details: e.errors }, { status: 400 });
    }
    return Response.json(
      { success: false, error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}
