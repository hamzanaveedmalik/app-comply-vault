import { requireAppAccess } from "~/server/auth/guards";
import { startMailboxSync } from "~/server/mailbox/ingest";
import { enqueueMailboxIngest } from "~/server/mailbox/queue";
import { processIngestJob } from "~/server/mailbox/ingest";
import { z } from "zod";

const bodySchema = z.object({
  kind: z.enum(["BACKFILL", "DELTA"]).default("BACKFILL"),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
): Promise<Response> {
  const access = await requireAppAccess();
  if (!access.ok) {
    return Response.json({ success: false, error: access.error }, { status: access.status });
  }
  if (access.session.user.role !== "OWNER_CCO") {
    return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  const kind = parsed.success ? parsed.data.kind : "BACKFILL";

  try {
    const { jobId } = await startMailboxSync({
      workspaceId: access.workspaceId,
      connectionId: id,
      kind,
      userId: access.session.user.id,
    });

    const queued = await enqueueMailboxIngest(jobId);
    if (!queued) {
      await processIngestJob(jobId);
    }

    return Response.json({ success: true, data: { jobId } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "sync_failed";
    return Response.json({ success: false, error: message }, { status: 400 });
  }
}
