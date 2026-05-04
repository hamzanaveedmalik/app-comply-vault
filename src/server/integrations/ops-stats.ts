/**
 * Internal Ops Dashboard — Epic 6 Story 6.8
 * Fetches queue depth, sync stats, and failed jobs for /internal/ops
 */

import { db } from "~/server/db";
import { getIntegrationQueue } from "./queue";

const PROVIDER_LABELS: Record<string, string> = {
  ZOOM: "Zoom",
  TEAMS: "Teams",
  SHAREPOINT: "SharePoint",
  GOOGLE_DRIVE: "Google Drive",
  REDTAIL: "Redtail",
  WEALTHBOX: "Wealthbox",
  DOCUSIGN: "DocuSign",
  RIA_IN_A_BOX: "RIA in a Box",
  SLACK: "Slack",
  ZOHO_CRM: "Zoho CRM",
};

export type ProviderStats = {
  provider: string;
  providerLabel: string;
  queueDepth: number;
  jobsProcessed24h: number;
  jobsFailed24h: number;
  failureRate24h: number;
  failureRate1h: number;
  alert1h: boolean;
};

export type FailedJob = {
  id: string;
  provider: string;
  providerLabel: string;
  errorMessage: string | null;
  meetingId: string | null;
  attempts: number;
  createdAt: Date;
};

export type OpsStats = {
  queueDepth: number;
  providerStats: ProviderStats[];
  failedJobs: FailedJob[];
  queueAvailable: boolean;
};

export async function getOpsStats(): Promise<OpsStats> {
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const queue = getIntegrationQueue();
  let queueDepth = 0;
  const providerQueueDepth: Record<string, number> = {};

  if (queue) {
    try {
      const counts = await queue.getJobCounts();
      queueDepth = (counts.waiting ?? 0) + (counts.active ?? 0);

      // Per-provider queue depth from waiting jobs (sample up to 500)
      const waiting = await queue.getWaiting(0, 500);
      for (const job of waiting) {
        const provider = (job.data as { provider?: string }).provider ?? "unknown";
        providerQueueDepth[provider] = (providerQueueDepth[provider] ?? 0) + 1;
      }
    } catch {
      // Redis/queue unavailable
    }
  }

  // Per-provider stats from IntegrationSyncLog
  const [success24h, failed24h, success1h, failed1h, recentFailed] =
    await Promise.all([
      db.integrationSyncLog.groupBy({
        by: ["provider"],
        where: {
          status: "success",
          completedAt: { gte: twentyFourHoursAgo },
        },
        _count: { id: true },
      }),
      db.integrationSyncLog.groupBy({
        by: ["provider"],
        where: {
          status: "failed",
          completedAt: { gte: twentyFourHoursAgo },
        },
        _count: { id: true },
      }),
      db.integrationSyncLog.groupBy({
        by: ["provider"],
        where: {
          status: "success",
          completedAt: { gte: oneHourAgo },
        },
        _count: { id: true },
      }),
      db.integrationSyncLog.groupBy({
        by: ["provider"],
        where: {
          status: "failed",
          completedAt: { gte: oneHourAgo },
        },
        _count: { id: true },
      }),
      db.integrationSyncLog.findMany({
        where: { status: "failed" },
        orderBy: { createdAt: "desc" },
        take: 50,
        select: {
          id: true,
          provider: true,
          errorMessage: true,
          meetingId: true,
          attempts: true,
          createdAt: true,
        },
      }),
    ]);

  const successByProvider24h = Object.fromEntries(
    success24h.map((s) => [s.provider, s._count.id])
  );
  const failedByProvider24h = Object.fromEntries(
    failed24h.map((f) => [f.provider, f._count.id])
  );
  const successByProvider1h = Object.fromEntries(
    success1h.map((s) => [s.provider, s._count.id])
  );
  const failedByProvider1h = Object.fromEntries(
    failed1h.map((f) => [f.provider, f._count.id])
  );

  const allProviders = new Set([
    ...Object.keys(successByProvider24h),
    ...Object.keys(failedByProvider24h),
    ...Object.keys(providerQueueDepth),
    ...recentFailed.map((j) => j.provider),
  ]);

  const providerStats: ProviderStats[] = Array.from(allProviders).map(
    (provider) => {
      const processed24h = successByProvider24h[provider] ?? 0;
      const failed24hCount = failedByProvider24h[provider] ?? 0;
      const total24h = processed24h + failed24hCount;
      const processed1h = successByProvider1h[provider] ?? 0;
      const failed1hCount = failedByProvider1h[provider] ?? 0;
      const total1h = processed1h + failed1hCount;

      const failureRate24h =
        total24h > 0 ? (failed24hCount / total24h) * 100 : 0;
      const failureRate1h =
        total1h > 0 ? (failed1hCount / total1h) * 100 : 0;
      const alert1h = failureRate1h > 10 && total1h > 0;

      return {
        provider,
        providerLabel: PROVIDER_LABELS[provider] ?? provider,
        queueDepth: providerQueueDepth[provider] ?? 0,
        jobsProcessed24h: processed24h,
        jobsFailed24h: failed24hCount,
        failureRate24h,
        failureRate1h,
        alert1h,
      };
    }
  );

  return {
    queueDepth,
    providerStats: providerStats.sort((a, b) =>
      a.providerLabel.localeCompare(b.providerLabel)
    ),
    failedJobs: recentFailed.map((j) => ({
      id: j.id,
      provider: j.provider,
      providerLabel: PROVIDER_LABELS[j.provider] ?? j.provider,
      errorMessage: j.errorMessage,
      meetingId: j.meetingId,
      attempts: j.attempts,
      createdAt: j.createdAt,
    })),
    queueAvailable: queue !== null,
  };
}
