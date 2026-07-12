/**
 * Thread list/detail queries.
 */

import { db } from "~/server/db";
import type {
  CommunicationMessageDto,
  CommunicationThreadDto,
} from "~/lib/types/evidence";

export async function listCommunicationThreads(
  workspaceId: string
): Promise<CommunicationThreadDto[]> {
  const threads = await db.communicationThread.findMany({
    where: { workspaceId, deletedAt: null },
    orderBy: { updatedAt: "desc" },
    take: 100,
    include: {
      messages: {
        where: { deletedAt: null },
        orderBy: { sentAt: "desc" },
        take: 1,
        include: { evidenceItem: { select: { clientId: true } } },
      },
      _count: { select: { messages: true } },
    },
  });

  const clientIds = [
    ...new Set(
      threads
        .flatMap((t) => t.messages.map((m) => m.evidenceItem.clientId))
        .filter((id): id is string => Boolean(id))
    ),
  ];
  const clients =
    clientIds.length > 0
      ? await db.client.findMany({
          where: { id: { in: clientIds } },
          select: { id: true, name: true },
        })
      : [];
  const clientMap = Object.fromEntries(clients.map((c) => [c.id, c.name]));

  return threads.map((t) => {
    const last = t.messages[0];
    const participants = t.participants as Array<{ address: string }>;
    const clientId = last?.evidenceItem.clientId ?? null;
    return {
      id: t.id,
      subject: t.subject,
      channel: t.channel,
      participantCount: participants.length,
      messageCount: t._count.messages,
      lastMessageAt: last?.sentAt.toISOString() ?? null,
      clientId,
      clientName: clientId ? (clientMap[clientId] ?? null) : null,
    };
  });
}

export async function getThreadDetail(args: {
  workspaceId: string;
  threadId: string;
}): Promise<{
  thread: CommunicationThreadDto;
  messages: CommunicationMessageDto[];
} | null> {
  const thread = await db.communicationThread.findFirst({
    where: {
      id: args.threadId,
      workspaceId: args.workspaceId,
      deletedAt: null,
    },
    include: {
      messages: {
        where: { deletedAt: null },
        orderBy: { sentAt: "asc" },
        include: {
          evidenceItem: { select: { clientId: true } },
          attachments: { where: { deletedAt: null } },
        },
      },
      _count: { select: { messages: true } },
    },
  });
  if (!thread) return null;

  const participants = thread.participants as Array<{ address: string }>;
  const clientId =
    thread.messages.find((m) => m.evidenceItem.clientId)?.evidenceItem
      .clientId ?? null;
  let clientName: string | null = null;
  if (clientId) {
    const client = await db.client.findFirst({
      where: { id: clientId },
      select: { name: true },
    });
    clientName = client?.name ?? null;
  }

  return {
    thread: {
      id: thread.id,
      subject: thread.subject,
      channel: thread.channel,
      participantCount: participants.length,
      messageCount: thread._count.messages,
      lastMessageAt:
        thread.messages.at(-1)?.sentAt.toISOString() ?? null,
      clientId,
      clientName,
    },
    messages: thread.messages.map((m) => ({
      id: m.id,
      evidenceItemId: m.evidenceItemId,
      direction: m.direction,
      sentAt: m.sentAt.toISOString(),
      fromAddress: m.fromAddress,
      toAddresses: m.toAddresses,
      ccAddresses: m.ccAddresses,
      bodyText: m.bodyText,
      bodyHtml: m.bodyHtml,
      attachments: m.attachments.map((a) => ({
        id: a.id,
        filename: a.filename,
        mimeType: a.mimeType,
        contentSha256: a.contentSha256,
        sizeBytes: a.sizeBytes,
      })),
    })),
  };
}
