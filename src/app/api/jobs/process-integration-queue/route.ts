/**
 * POST /api/jobs/process-integration-queue
 * Epic 6 Story 6.3: Process integration write jobs from BullMQ queue
 * Call via QStash or Vercel Cron to drain the queue (serverless-compatible)
 */

import { getIntegrationQueue } from "~/server/integrations/queue";
import { processIntegrationJob } from "~/server/integrations/worker";
import { env } from "~/env";

export const maxDuration = 60;

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const queue = getIntegrationQueue();
  if (!queue) {
    return Response.json({ success: true, processed: 0, message: "Queue not configured" });
  }

  const waitingJobs = await queue.getWaiting(0, 9);
  let processed = 0;

  for (const job of waitingJobs) {
    try {
      await processIntegrationJob(job);
      await job.moveToCompleted(undefined, "");
      processed++;
    } catch (error) {
      await job.moveToFailed(error instanceof Error ? error : new Error(String(error)), "");
    }
  }

  return Response.json({ success: true, processed });
}
