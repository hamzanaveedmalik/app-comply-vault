/**
 * Integration write queue — BullMQ + Redis
 * Epic 6 Story 6.3: Async processing, 3 retries, exponential backoff
 */

import { Queue, Worker, type Job } from "bullmq";
import IORedis from "ioredis";
import { env } from "~/env";

const QUEUE_NAME = "integration-writes";
const REDIS_URL = env.REDIS_URL;

function getConnection(): IORedis | null {
  if (!REDIS_URL) return null;
  return new IORedis(REDIS_URL, { maxRetriesPerRequest: null });
}

let _queue: Queue | null = null;

export function getIntegrationQueue(): Queue | null {
  if (!REDIS_URL) return null;
  if (_queue) return _queue;
  const connection = getConnection();
  if (!connection) return null;
  _queue = new Queue(QUEUE_NAME, {
    connection,
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 60_000, // 1min, 5min, 30min (approx)
      },
      removeOnComplete: { count: 1000 },
      removeOnFail: { count: 5000 },
    },
  });
  return _queue;
}

export type IntegrationJobPayload = {
  workspaceId: string;
  meetingId: string;
  provider: string;
  action: string;
  payload: Record<string, unknown>;
};

export async function enqueueIntegrationWrite(
  params: IntegrationJobPayload
): Promise<string | null> {
  const queue = getIntegrationQueue();
  if (!queue) return null;
  const job = await queue.add("write", params, {
    jobId: `${params.provider}-${params.meetingId}-${params.action}-${Date.now()}`,
  });
  return job.id ?? null;
}

export function createIntegrationWorker(
  processor: (job: Job<IntegrationJobPayload>) => Promise<void>
): Worker | null {
  if (!REDIS_URL) return null;
  const connection = getConnection();
  if (!connection) return null;
  return new Worker(
    QUEUE_NAME,
    async (job) => {
      await processor(job);
    },
    {
      connection,
      concurrency: 5,
    }
  );
}
