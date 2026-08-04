import { z } from "zod";
import { isComplianceActor } from "~/lib/meeting-workflow";
import { requireAppAccess } from "~/server/auth/guards";
import { db } from "~/server/db";
import {
  getOrCreateSamplingConfig,
  updateSamplingConfig,
} from "~/server/supervision/service";

const patchSchema = z.object({
  randomPercentage: z.number().int().min(0).max(100).optional(),
  adviserRiskEnabled: z.boolean().optional(),
  adviserRiskOpenFlagFloor: z.number().int().min(1).max(100).optional(),
  newAdviserEnabled: z.boolean().optional(),
  newAdviserWindowDays: z.number().int().min(1).max(365).optional(),
  timeSinceLastReviewEnabled: z.boolean().optional(),
  reviewStalenessDays: z.number().int().min(1).max(365).optional(),
  manualSelectionEnabled: z.boolean().optional(),
  controlSamplingPolicy: z.record(z.string(), z.number().min(0).max(100)).optional(),
});

export async function GET(): Promise<Response> {
  const access = await requireAppAccess();
  if (!access.ok) {
    return Response.json({ success: false, error: access.error }, { status: access.status });
  }

  const data = await getOrCreateSamplingConfig(db, access.workspaceId);
  return Response.json({ success: true, data });
}

export async function PATCH(request: Request): Promise<Response> {
  const access = await requireAppAccess();
  if (!access.ok) {
    return Response.json({ success: false, error: access.error }, { status: access.status });
  }

  if (!isComplianceActor(access.session.user.role)) {
    return Response.json(
      { success: false, error: "Only compliance roles can update sampling configuration" },
      { status: 403 },
    );
  }

  try {
    const body = patchSchema.parse(await request.json());
    const data = await updateSamplingConfig(db, {
      workspaceId: access.workspaceId,
      userId: access.session.user.id,
      patch: body,
    });
    return Response.json({ success: true, data });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ success: false, error: "Invalid input" }, { status: 400 });
    }
    return Response.json(
      { success: false, error: error instanceof Error ? error.message : "Update failed" },
      { status: 500 },
    );
  }
}
