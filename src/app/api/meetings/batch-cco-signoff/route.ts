import { requireAppAccess } from "~/server/auth/guards";
import { db } from "~/server/db";
import {
  hasPendingCcoEscalations,
  isCcoActor,
  meetingAllowsCcoSignOff,
} from "~/lib/meeting-workflow";
import { z } from "zod";

export const runtime = "nodejs";

const bodySchema = z.object({
  meetingIds: z.array(z.string().min(1)).min(1).max(100),
});

export async function POST(request: Request): Promise<Response> {
  try {
    const access = await requireAppAccess();
    if (!access.ok) {
      return Response.json({ success: false, error: access.error }, { status: access.status });
    }
    const { session, workspaceId } = access;

    if (!isCcoActor(session.user.role)) {
      return Response.json({ success: false, error: "Only the CCO can batch sign off" }, { status: 403 });
    }

    const { meetingIds } = bodySchema.parse(await request.json());

    const result = await db.$transaction(async (tx) => {
      const meetings = await tx.meeting.findMany({
        where: { workspaceId, id: { in: meetingIds } },
        include: { flags: true },
      });

      if (meetings.length !== meetingIds.length) {
        throw new Error("One or more meetings were not found in this workspace");
      }

      const now = new Date();
      const signed: string[] = [];

      for (const meeting of meetings) {
        if (!meetingAllowsCcoSignOff(meeting.status)) {
          throw new Error(
            `Meeting ${meeting.clientName} must be CM_REVIEWED (currently ${meeting.status})`
          );
        }
        if (hasPendingCcoEscalations(meeting.flags)) {
          throw new Error(
            `Meeting ${meeting.clientName} has unresolved escalations; use individual review`
          );
        }

        await tx.meeting.update({
          where: { id: meeting.id },
          data: {
            status: "CCO_SIGNED_OFF",
            ccoSignedOffAt: now,
            ccoSignedOffByUserId: session.user.id,
          },
        });

        await tx.auditEvent.create({
          data: {
            workspaceId,
            userId: session.user.id,
            action: "CCO_SIGNED_OFF",
            resourceType: "meeting",
            resourceId: meeting.id,
            meetingId: meeting.id,
            metadata: {
              batch: true,
              signedAt: now.toISOString(),
            },
          },
        });

        signed.push(meeting.id);
      }

      return signed;
    });

    return Response.json({
      success: true,
      data: { signedOff: result.length, meetingIds: result },
    });
  } catch (e) {
    console.error("batch-cco-signoff:", e);
    if (e instanceof z.ZodError) {
      return Response.json({ success: false, error: "Invalid body", details: e.errors }, { status: 400 });
    }
    return Response.json(
      { success: false, error: e instanceof Error ? e.message : "Unknown error" },
      { status: 400 }
    );
  }
}
