import { z } from "zod";
import { requireAppAccess } from "~/server/auth/guards";
import { db } from "~/server/db";
import { parseSupervisionFilters, toSummaryQuery } from "~/server/supervision/filters";
import { getSupervisionSummary } from "~/server/supervision/service";

const querySchema = z.record(z.string(), z.string().optional());

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

  const query = toSummaryQuery(parseSupervisionFilters(parsed.data));
  const data = await getSupervisionSummary(db, access.workspaceId, {
    dateFrom: query.dateFrom,
    dateTo: query.dateTo,
    firmId: query.firmId,
    adviserId: query.adviserId,
    channel: query.channel,
    control: query.control,
    outcome: query.outcome,
    severity: query.severity,
    findingStatus: query.findingStatus,
  });

  return Response.json({ success: true, data });
}
