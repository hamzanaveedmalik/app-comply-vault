/**
 * Integration write worker — Epic 6 Story 6.3
 * Processes BullMQ jobs; when adapters exist, dispatches to them
 */

import { db } from "~/server/db";
import { createIntegrationWorker, type IntegrationJobPayload } from "./queue";
import type { IntegrationProvider } from "../../../generated/prisma";

export async function processIntegrationJob(
  job: import("bullmq").Job<IntegrationJobPayload>
): Promise<void> {
  const { workspaceId, meetingId, provider, action, payload } = job.data;

  const config = await db.integrationConfig.findFirst({
    where: { workspaceId, provider: provider as IntegrationProvider },
  });

  const logEntry = await db.integrationSyncLog.create({
    data: {
      integrationConfigId: config?.id,
      meetingId,
      provider: provider as IntegrationProvider,
      action,
      status: "pending",
      attempts: job.attemptsMade + 1,
    },
  });

  try {
    // Adapters will be registered when built (Zoom, Redtail, etc.)
    // For now, no adapters exist — job "succeeds" as no-op
    // When adapter exists: await adapters[provider].sync({ workspaceId, meetingId, payload });

    await db.integrationSyncLog.update({
      where: { id: logEntry.id },
      data: { status: "success", completedAt: new Date() },
    });

    if (config) {
      await db.integrationConfig.update({
        where: { id: config.id },
        data: {
          lastSyncAt: new Date(),
          lastErrorAt: null,
          lastErrorMessage: null,
        },
      });
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    await db.integrationSyncLog.update({
      where: { id: logEntry.id },
      data: {
        status: "failed",
        errorMessage: errorMessage,
        completedAt: new Date(),
      },
    });

    if (config) {
      await db.integrationConfig.update({
        where: { id: config.id },
        data: {
          lastErrorAt: new Date(),
          lastErrorMessage: errorMessage,
        },
      });
    }
    throw error;
  }
}

export function startIntegrationWorker(): ReturnType<typeof createIntegrationWorker> {
  return createIntegrationWorker(processIntegrationJob);
}
