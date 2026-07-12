/**
 * Mailbox connection DTOs and queries.
 */

import { db } from "~/server/db";
import type { MailboxConnectionDto } from "~/lib/types/evidence";

export function toMailboxConnectionDto(row: {
  id: string;
  mailboxAddress: string;
  provider: string;
  consentMode: string;
  scopeFolders: string[];
  backfillFrom: Date | null;
  status: string;
  lastSyncAt: Date | null;
  lastErrorMessage: string | null;
}): MailboxConnectionDto {
  return {
    id: row.id,
    mailboxAddress: row.mailboxAddress,
    provider: row.provider,
    consentMode: row.consentMode,
    scopeFolders: row.scopeFolders,
    backfillFrom: row.backfillFrom?.toISOString() ?? null,
    status: row.status,
    lastSyncAt: row.lastSyncAt?.toISOString() ?? null,
    lastErrorMessage: row.lastErrorMessage,
  };
}

export async function listMailboxConnections(
  workspaceId: string
): Promise<MailboxConnectionDto[]> {
  const rows = await db.mailboxConnection.findMany({
    where: { workspaceId, deletedAt: null },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(toMailboxConnectionDto);
}
