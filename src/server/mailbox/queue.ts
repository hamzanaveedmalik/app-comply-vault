/**
 * Mailbox ingest queue — BullMQ.
 * Epic B CV-B-03
 */

import { Queue, Worker, type Job } from "bullmq";
import IORedis from "ioredis";
import { env } from "~/env";
import { processIngestJob } from "./ingest";

const QUEUE_NAME = "mailbox-ingest";

function getConnection(): IORedis | null {
  if (!env.REDIS_URL) return null;
  return new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });
}

let _queue: Queue | null = null;

export function getMailboxIngestQueue(): Queue | null {
  if (!env.REDIS_URL) return null;
  if (_queue) return _queue;
  const connection = getConnection();
  if (!connection) return null;
  _queue = new Queue(QUEUE_NAME, {
    connection,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 60_000 },
      removeOnComplete: { count: 500 },
      removeOnFail: { count: 2000 },
    },
  });
  return _queue;
}

export type MailboxIngestJobPayload = { jobId: string };

export async function enqueueMailboxIngest(
  jobId: string
): Promise<string | null> {
  const queue = getMailboxIngestQueue();
  if (!queue) return null;
  const job = await queue.add("ingest", { jobId }, { jobId: `mailbox-${jobId}` });
  return job.id ?? null;
}

export function createMailboxIngestWorker(): Worker | null {
  if (!env.REDIS_URL) return null;
  const connection = getConnection();
  if (!connection) return null;
  return new Worker(
    QUEUE_NAME,
    async (job: Job<MailboxIngestJobPayload>) => {
      await processIngestJob(job.data.jobId);
    },
    { connection, concurrency: 2 }
  );
}
