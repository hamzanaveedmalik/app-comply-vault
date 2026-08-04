import { z } from "zod";
import { isComplianceActor } from "~/lib/meeting-workflow";
import { requireAppAccess } from "~/server/auth/guards";
import { db } from "~/server/db";
import {
  manuallyEscalateSampledInteraction,
  manuallySelectForSampling,
  parkInteraction,
} from "~/server/supervision/service";

const bodySchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("sample"),
    channel: z.enum(["MEETING", "EMAIL"]),
    reason: z.string().min(3).max(500).optional(),
  }),
  z.object({
    action: z.literal("escalate"),
    channel: z.enum(["MEETING", "EMAIL"]),
    escalationReason: z.string().min(10).max(2000),
    controlType: z.string().min(1).optional(),
  }),
  z.object({
    action: z.literal("park"),
    channel: z.enum(["MEETING", "EMAIL"]),
    reason: z.string().min(3).max(2000),
  }),
]);

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const access = await requireAppAccess();
  if (!access.ok) {
    return Response.json({ success: false, error: access.error }, { status: access.status });
  }

  if (!isComplianceActor(access.session.user.role)) {
    return Response.json(
      { success: false, error: "Only compliance roles can change supervisory outcomes" },
      { status: 403 },
    );
  }

  try {
    const { id } = await params;
    const body = bodySchema.parse(await request.json());

    if (body.action === "sample") {
      const result = await manuallySelectForSampling({
        db,
        workspaceId: access.workspaceId,
        userId: access.session.user.id,
        channel: body.channel,
        interactionId: id,
        reason: body.reason,
      });
      if (!result.success) {
        return Response.json({ success: false, error: result.error }, { status: 400 });
      }
      return Response.json({ success: true, data: result.data });
    }

    if (body.action === "escalate") {
      const result = await manuallyEscalateSampledInteraction({
        db,
        workspaceId: access.workspaceId,
        userId: access.session.user.id,
        channel: body.channel,
        interactionId: id,
        escalationReason: body.escalationReason,
        controlType: body.controlType,
      });
      if (!result.success) {
        return Response.json({ success: false, error: result.error }, { status: 400 });
      }
      return Response.json({ success: true, data: result.data });
    }

    const result = await parkInteraction({
      db,
      workspaceId: access.workspaceId,
      userId: access.session.user.id,
      channel: body.channel,
      interactionId: id,
      reason: body.reason,
    });
    if (!result.success) {
      return Response.json({ success: false, error: result.error }, { status: 400 });
    }
    return Response.json({ success: true, data: { outcome: "PARKED" } });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ success: false, error: "Invalid input" }, { status: 400 });
    }
    return Response.json(
      { success: false, error: error instanceof Error ? error.message : "Request failed" },
      { status: 500 },
    );
  }
}
