import { z } from "zod";
import { requireAppAccess } from "~/server/auth/guards";
import { db } from "~/server/db";
import { getPortfolioSupervisionSummary } from "~/server/supervision/portfolio";

const querySchema = z.object({
  firmId: z.string().min(1).optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
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

  const data = await getPortfolioSupervisionSummary(db, access.session.user.id, {
    firmId: parsed.data.firmId,
    dateFrom: parsed.data.dateFrom ? new Date(parsed.data.dateFrom) : undefined,
    dateTo: parsed.data.dateTo ? new Date(parsed.data.dateTo) : undefined,
  });

  return Response.json({ success: true, data });
}
