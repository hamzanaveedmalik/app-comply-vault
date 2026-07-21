/**
 * Client detail + list queries for Email Intelligence Phase 1.
 */

import { db } from "~/server/db";
import { getHouseholdClientIds } from "./household";
import { countCorrespondenceInPeriod } from "./activity";
import type {
  ClientCorrespondenceRowDto,
  ClientDetailDto,
  ClientListItemDto,
} from "~/lib/types/clients";

export type {
  ClientCorrespondenceRowDto,
  ClientDetailDto,
  ClientListItemDto,
} from "~/lib/types/clients";

export async function listClientsForWorkspace(
  workspaceId: string
): Promise<ClientListItemDto[]> {
  const clients = await db.client.findMany({
    where: { workspaceId, deletedAt: null },
    orderBy: { name: "asc" },
    take: 500,
    select: { id: true, name: true, status: true, lastContactAt: true },
  });
  return clients.map((c) => ({
    id: c.id,
    name: c.name,
    status: c.status,
    lastContactAt: c.lastContactAt?.toISOString() ?? null,
  }));
}

export async function getClientDetail(args: {
  workspaceId: string;
  clientId: string;
  periodDays?: number;
}): Promise<ClientDetailDto | null> {
  const client = await db.client.findFirst({
    where: {
      id: args.clientId,
      workspaceId: args.workspaceId,
      deletedAt: null,
    },
    select: {
      id: true,
      name: true,
      status: true,
      lastContactAt: true,
    },
  });
  if (!client) return null;

  const periodDays = args.periodDays ?? 90;
  const periodEnd = new Date();
  const periodStart = new Date(periodEnd.getTime() - periodDays * 24 * 60 * 60 * 1000);

  const clientIds = await getHouseholdClientIds({
    workspaceId: args.workspaceId,
    clientId: client.id,
  });

  const memberships = await db.clientHouseholdMember.findMany({
    where: {
      clientId: { in: clientIds },
      deletedAt: null,
      household: { workspaceId: args.workspaceId, deletedAt: null },
    },
    select: {
      id: true,
      clientId: true,
      role: true,
      client: { select: { name: true } },
    },
  });

  const aliases = await db.emailAlias.findMany({
    where: {
      workspaceId: args.workspaceId,
      clientId: { in: clientIds },
      deletedAt: null,
    },
    select: { id: true, clientId: true, address: true },
  });
  const aliasesByClient = new Map<string, Array<{ id: string; address: string }>>();
  for (const a of aliases) {
    if (!a.clientId) continue;
    const list = aliasesByClient.get(a.clientId) ?? [];
    list.push({ id: a.id, address: a.address });
    aliasesByClient.set(a.clientId, list);
  }

  const nameById = new Map<string, string>();
  nameById.set(client.id, client.name);
  for (const m of memberships) {
    nameById.set(m.clientId, m.client.name);
  }
  if (clientIds.length > 1) {
    const peers = await db.client.findMany({
      where: { id: { in: clientIds }, workspaceId: args.workspaceId },
      select: { id: true, name: true },
    });
    for (const p of peers) nameById.set(p.id, p.name);
  }

  const householdMembers = memberships
    .filter((m) => m.clientId !== client.id)
    .map((m) => ({
      membershipId: m.id,
      clientId: m.clientId,
      name: m.client.name,
      role: m.role,
      emailAddresses: aliasesByClient.get(m.clientId) ?? [],
    }));

  const correspondenceCountPeriod = await countCorrespondenceInPeriod({
    workspaceId: args.workspaceId,
    clientIds,
    from: periodStart,
    to: periodEnd,
  });

  const activities = await db.clientActivity.findMany({
    where: {
      workspaceId: args.workspaceId,
      clientId: { in: clientIds },
      deletedAt: null,
    },
    orderBy: { occurredAt: "desc" },
    take: 100,
  });

  const correspondence: ClientCorrespondenceRowDto[] = activities.map((a) => ({
    id: a.id,
    type: a.type,
    direction: a.direction,
    title: a.title,
    counterparties: a.counterparties,
    occurredAt: a.occurredAt.toISOString(),
    contentSha256: a.contentSha256,
    threadId: a.threadId,
    evidenceItemId: a.evidenceItemId,
    viaHouseholdMember: a.clientId !== client.id,
    memberClientName:
      a.clientId !== client.id ? (nameById.get(a.clientId) ?? null) : null,
  }));

  return {
    id: client.id,
    name: client.name,
    status: client.status,
    lastContactAt: client.lastContactAt?.toISOString() ?? null,
    correspondenceCountPeriod,
    periodLabel: `Last ${periodDays} days`,
    emailAddresses: aliasesByClient.get(client.id) ?? [],
    householdMembers,
    correspondence,
  };
}
