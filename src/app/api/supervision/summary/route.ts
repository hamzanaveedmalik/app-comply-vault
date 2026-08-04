import { z } from "zod";
import { requireAppAccess } from "~/server/auth/guards";
import { db } from "~/server/db";
import { getSupervisionSummary } from "~/server/supervision/service";

const querySchema = z.object({
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  firmId: z.string().min(1).optional(),
  adviserId: z.string().min(1).optional(),
  channel: z.enum(["MEETING", "EMAIL"]).optional(),
  control: z.string().min(1).optional(),
  outcome: z
    .enum(["CLEARED", "ROUTINE_SAMPLE", "ESCALATED", "HELD", "PARKED"])
    .optional(),
});

export async function GET(request: Request): Promise<Response> {
  const access = await requireAppAccess();
  if (!access.ok) {
    return Response.json({ success: false, error: access.error }, { status: access.status });
  }

  const rawQuery = Object.fromEntries(new URL(request.url).searchParams.entries());
  const parsed = querySchema.safeParse(rawQuery);
  if (!parsed.success) {
    return Response.json({ success: false, error: "Invalid query" }, { status: 400 });
  }

  const data = await getSupervisionSummary(db, access.workspaceId, {
    dateFrom: parsed.data.dateFrom ? new Date(parsed.data.dateFrom) : undefined,
    dateTo: parsed.data.dateTo ? new Date(parsed.data.dateTo) : undefined,
    firmId: parsed.data.firmId,
    adviserId: parsed.data.adviserId,
    channel: parsed.data.channel,
    control: parsed.data.control,
    outcome: parsed.data.outcome,
  });

  return Response.json({ success: true, data });
}
