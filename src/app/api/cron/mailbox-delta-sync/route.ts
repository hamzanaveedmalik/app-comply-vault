import { db } from "~/server/db";
import { startMailboxSync } from "~/server/mailbox/ingest";
import { enqueueMailboxIngest } from "~/server/mailbox/queue";
import { processIngestJob } from "~/server/mailbox/ingest";
import { WorkspaceRole } from "../../../../../generated/prisma";

export const runtime = "nodejs";
export const maxDuration = 300;

async function resolveCronActorUserId(workspaceId: string): Promise<string | null> {
  const owner = await db.userWorkspace.findFirst({
    where: { workspaceId, role: WorkspaceRole.OWNER_CCO, removedAt: null },
    select: { userId: true },
  });
  return owner?.userId ?? null;
}

export async function POST(request: Request): Promise<Response> {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const connections = await db.mailboxConnection.findMany({
    where: { status: "ACTIVE", deletedAt: null },
    select: { id: true, workspaceId: true },
  });

  const results: Array<{ connectionId: string; jobId: string }> = [];

  for (const conn of connections) {
    const actorUserId = await resolveCronActorUserId(conn.workspaceId);
    if (!actorUserId) continue;

    const { jobId } = await startMailboxSync({
      workspaceId: conn.workspaceId,
      connectionId: conn.id,
      kind: "DELTA",
      userId: actorUserId,
    });
    const queued = await enqueueMailboxIngest(jobId);
    if (!queued) {
      void processIngestJob(jobId).catch(() => undefined);
    }
    results.push({ connectionId: conn.id, jobId });
  }

  return Response.json({ success: true, data: { started: results.length, results } });
}
