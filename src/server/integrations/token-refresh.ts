/**
 * OAuth token refresh — Epic 6 Story 6.2
 * Runs every 15 mins; on refresh failure, updates status to ERROR and notifies CCO
 */

import { db } from "~/server/db";
import { decryptToken, encryptToken } from "./crypto";
import { sendIntegrationReconnectEmail } from "~/server/email";
import type { IntegrationProvider } from "../../../generated/prisma";

const REFRESH_BUFFER_MS = 15 * 60 * 1000; // Refresh if expiring within 15 mins

export async function refreshExpiringTokens(): Promise<{ refreshed: number; failed: number }> {
  if (!process.env.INTEGRATION_ENCRYPTION_KEY) {
    return { refreshed: 0, failed: 0 };
  }

  const now = new Date();
  const threshold = new Date(now.getTime() + REFRESH_BUFFER_MS);

  const credentials = await db.integrationCredential.findMany({
    where: {
      status: "CONNECTED",
      OR: [
        { expiresAt: { lt: threshold } },
        { expiresAt: null },
      ],
    },
    include: {
      workspace: { select: { name: true } },
    },
  });

  let refreshed = 0;
  let failed = 0;

  for (const cred of credentials) {
    try {
      const refreshedTokens = await refreshTokenForProvider(
        cred.provider,
        cred.refreshTokenEncrypted,
        cred.workspaceId
      );

      if (refreshedTokens) {
        await db.integrationCredential.update({
          where: { id: cred.id },
          data: {
            accessTokenEncrypted: encryptToken(refreshedTokens.accessToken),
            refreshTokenEncrypted: refreshedTokens.refreshToken
              ? encryptToken(refreshedTokens.refreshToken)
              : undefined,
            expiresAt: refreshedTokens.expiresAt,
            status: "CONNECTED",
          },
        });
        refreshed++;
      }
    } catch (error) {
      failed++;
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      await db.integrationCredential.update({
        where: { id: cred.id },
        data: { status: "ERROR_ACTION_REQUIRED" },
      });

      await db.integrationConfig.updateMany({
        where: { workspaceId: cred.workspaceId, provider: cred.provider },
        data: {
          lastErrorAt: now,
          lastErrorMessage: `Token refresh failed: ${errorMessage}`,
        },
      });

      const owner = await db.userWorkspace.findFirst({
        where: { workspaceId: cred.workspaceId, role: "OWNER_CCO" },
        include: { user: { select: { email: true } } },
      });
      if (owner?.user?.email) {
        await sendIntegrationReconnectEmail({
          email: owner.user.email,
          workspaceName: cred.workspace.name,
          provider: cred.provider,
        });
      }
    }
  }

  return { refreshed, failed };
}

async function refreshTokenForProvider(
  provider: IntegrationProvider,
  refreshTokenEncrypted: string | null,
  _workspaceId: string
): Promise<{ accessToken: string; refreshToken?: string; expiresAt?: Date } | null> {
  if (!refreshTokenEncrypted) return null;

  const refreshToken = decryptToken(refreshTokenEncrypted);

  switch (provider) {
    case "ZOOM":
    case "TEAMS":
    case "SHAREPOINT":
    case "GOOGLE_DRIVE":
    case "DOCUSIGN":
    case "SLACK":
    case "WEALTHBOX":
    case "SALESFORCE":
    case "COMPLYSCI":
      // Provider-specific refresh will be implemented when adapters are built
      // For now, throw to simulate failure (or return null to skip)
      throw new Error(`${provider} token refresh not yet implemented`);
    case "REDTAIL":
    case "RIA_IN_A_BOX":
    case "SMARTVAULT":
    case "TEAMS_BOT":
      // API key based — no refresh
      return null;
    default:
      return null;
  }
}
