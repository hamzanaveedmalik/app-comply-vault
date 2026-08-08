import { z } from "zod";
import { requireAppAccess } from "~/server/auth/guards";
import { db } from "~/server/db";
import { parseSupervisionFilters } from "~/server/supervision/filters";
import { DEFAULT_INBOX_TAB, listPriorityInbox } from "~/server/supervision/inbox";

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

  const filters = parseSupervisionFilters(parsed.data);
  const data = await listPriorityInbox(db, {
    userId: access.session.user.id,
    filters,
    tab: filters.inboxTab ?? DEFAULT_INBOX_TAB,
  });

  return Response.json({ success: true, data });
}
