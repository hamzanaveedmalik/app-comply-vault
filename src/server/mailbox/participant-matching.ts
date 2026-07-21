/**
 * Participant matching — exact address auto-link; fuzzy → triage queue.
 * Epic B CV-B-06 + Email Intelligence Phase 1 (household, retroactive attach).
 */

import { db } from "~/server/db";
import { getValidZohoCrmContext } from "~/server/integrations/zoho/crm-token";
import { findContactIdByEmail } from "~/server/integrations/zoho/crm-api";
import { recordEmailCorrespondenceActivity } from "~/server/clients/activity";
import { getHouseholdClientIds } from "~/server/clients/household";
import { isEmailIntelligenceEnabled } from "~/lib/feature-flags";

export type ParticipantMatch = {
  address: string;
  userId: string | null;
  clientId: string | null;
  verified: boolean;
  source: "alias" | "user" | "client" | "household" | "zoho" | "triage";
};

export function normalizeParticipantAddress(addr: string): string {
  return addr.trim().toLowerCase();
}

/**
 * Prefer the first matched client; when email intelligence is on, household
 * peers are already independent Client rows with their own aliases.
 */
export function selectClientIdFromMatches(
  matches: ParticipantMatch[]
): string | null {
  return matches.find((p) => p.clientId)?.clientId ?? null;
}

export async function matchParticipantAddress(args: {
  workspaceId: string;
  address: string;
}): Promise<ParticipantMatch> {
  const address = normalizeParticipantAddress(args.address);

  const verifiedAlias = await db.emailAlias.findFirst({
    where: {
      workspaceId: args.workspaceId,
      address,
      verified: true,
      deletedAt: null,
    },
    select: { userId: true, clientId: true },
  });
  if (verifiedAlias) {
    return {
      address,
      userId: verifiedAlias.userId,
      clientId: verifiedAlias.clientId,
      verified: true,
      source: "alias",
    };
  }

  const user = await db.user.findFirst({
    where: { email: { equals: address, mode: "insensitive" } },
    select: { id: true },
  });
  if (user) {
    await upsertVerifiedAlias({
      workspaceId: args.workspaceId,
      address,
      userId: user.id,
      clientId: null,
    });
    return {
      address,
      userId: user.id,
      clientId: null,
      verified: true,
      source: "user",
    };
  }

  const clientAlias = await db.emailAlias.findFirst({
    where: {
      workspaceId: args.workspaceId,
      address,
      clientId: { not: null },
      deletedAt: null,
    },
    select: { clientId: true },
  });
  if (clientAlias?.clientId) {
    await upsertVerifiedAlias({
      workspaceId: args.workspaceId,
      address,
      userId: null,
      clientId: clientAlias.clientId,
    });

    let source: ParticipantMatch["source"] = "client";
    if (isEmailIntelligenceEnabled()) {
      const household = await getHouseholdClientIds({
        workspaceId: args.workspaceId,
        clientId: clientAlias.clientId,
      });
      if (household.length > 1) source = "household";
    }

    return {
      address,
      userId: null,
      clientId: clientAlias.clientId,
      verified: true,
      source,
    };
  }

  const zohoMatch = await tryZohoEmailMatch({
    workspaceId: args.workspaceId,
    address,
  });
  if (zohoMatch) {
    return zohoMatch;
  }

  await ensureTriageItem({ workspaceId: args.workspaceId, address });

  return {
    address,
    userId: null,
    clientId: null,
    verified: false,
    source: "triage",
  };
}

async function tryZohoEmailMatch(args: {
  workspaceId: string;
  address: string;
}): Promise<ParticipantMatch | null> {
  try {
    const tokenInfo = await getValidZohoCrmContext(args.workspaceId);
    if (!tokenInfo) return null;

    const contactId = await findContactIdByEmail({
      apiDomain: tokenInfo.apiDomain,
      accessToken: tokenInfo.accessToken,
      email: args.address,
    });
    if (!contactId) return null;

    let client = await db.client.findFirst({
      where: { workspaceId: args.workspaceId, zohoId: contactId, deletedAt: null },
      select: { id: true },
    });

    if (!client) {
      client = await db.client.create({
        data: {
          workspaceId: args.workspaceId,
          name: `Zoho contact ${contactId}`,
          zohoId: contactId,
          status: "CLIENT",
        },
        select: { id: true },
      });
    }

    await upsertVerifiedAlias({
      workspaceId: args.workspaceId,
      address: args.address,
      userId: null,
      clientId: client.id,
    });

    return {
      address: args.address,
      userId: null,
      clientId: client.id,
      verified: true,
      source: "zoho",
    };
  } catch {
    return null;
  }
}

async function upsertVerifiedAlias(args: {
  workspaceId: string;
  address: string;
  userId: string | null;
  clientId: string | null;
}): Promise<void> {
  const existing = await db.emailAlias.findFirst({
    where: {
      workspaceId: args.workspaceId,
      address: args.address,
      deletedAt: null,
    },
  });

  if (existing) {
    await db.emailAlias.update({
      where: { id: existing.id },
      data: {
        userId: args.userId,
        clientId: args.clientId,
        verified: true,
      },
    });
    return;
  }

  await db.emailAlias.create({
    data: {
      workspaceId: args.workspaceId,
      address: args.address,
      userId: args.userId,
      clientId: args.clientId,
      verified: true,
    },
  });
}

async function ensureTriageItem(args: {
  workspaceId: string;
  address: string;
}): Promise<void> {
  await db.emailTriageItem.upsert({
    where: {
      workspaceId_address: {
        workspaceId: args.workspaceId,
        address: args.address,
      },
    },
    create: {
      workspaceId: args.workspaceId,
      address: args.address,
      status: "PENDING",
    },
    update: {},
  });
}

export async function resolveTriageItem(args: {
  workspaceId: string;
  triageId: string;
  status: "CONFIRMED" | "EXTERNAL" | "IRRELEVANT";
  userId?: string | null;
  clientId?: string | null;
  resolvedBy: string;
  notes?: string;
}): Promise<void> {
  const item = await db.emailTriageItem.findFirst({
    where: { id: args.triageId, workspaceId: args.workspaceId },
  });
  if (!item) throw new Error("Triage item not found");

  await db.$transaction(async (tx) => {
    await tx.emailTriageItem.update({
      where: { id: item.id },
      data: {
        status: args.status,
        userId: args.userId ?? null,
        clientId: args.clientId ?? null,
        resolvedBy: args.resolvedBy,
        resolvedAt: new Date(),
        notes: args.notes ?? null,
      },
    });

    if (args.status === "CONFIRMED" && (args.userId || args.clientId)) {
      const existing = await tx.emailAlias.findFirst({
        where: {
          workspaceId: args.workspaceId,
          address: item.address,
          deletedAt: null,
        },
      });
      if (existing) {
        await tx.emailAlias.update({
          where: { id: existing.id },
          data: {
            userId: args.userId ?? null,
            clientId: args.clientId ?? null,
            verified: true,
          },
        });
      } else {
        await tx.emailAlias.create({
          data: {
            workspaceId: args.workspaceId,
            address: item.address,
            userId: args.userId ?? null,
            clientId: args.clientId ?? null,
            verified: true,
          },
        });
      }
    }
  });
}

export type BackfillResult = {
  threadsUpdated: number;
  evidenceAttached: number;
};

/**
 * Count distinct threads that include this address (for triage confirmation UI).
 */
export async function countHistoricalThreadsForAddress(args: {
  workspaceId: string;
  address: string;
}): Promise<number> {
  const address = normalizeParticipantAddress(args.address);
  const threads = await db.communicationThread.findMany({
    where: { workspaceId: args.workspaceId, deletedAt: null },
    select: { participants: true },
  });

  let count = 0;
  for (const thread of threads) {
    const participants = thread.participants as Array<{ address: string }>;
    if (
      participants.some((p) => normalizeParticipantAddress(p.address) === address)
    ) {
      count += 1;
    }
  }
  return count;
}

/**
 * After triage confirms an address → client: update thread participant JSON and
 * retroactively set EvidenceItem.clientId on unmatched messages involving that address.
 */
export async function backfillParticipantLinks(args: {
  workspaceId: string;
  address: string;
  userId?: string | null;
  clientId?: string | null;
}): Promise<BackfillResult> {
  const address = normalizeParticipantAddress(args.address);
  const threads = await db.communicationThread.findMany({
    where: {
      workspaceId: args.workspaceId,
      deletedAt: null,
    },
    select: { id: true, participants: true },
  });

  let threadsUpdated = 0;
  for (const thread of threads) {
    const participants = thread.participants as Array<{
      address: string;
      userId?: string | null;
      clientId?: string | null;
    }>;
    let changed = false;
    const next = participants.map((p) => {
      if (normalizeParticipantAddress(p.address) !== address) return p;
      changed = true;
      return {
        ...p,
        userId: args.userId ?? p.userId ?? null,
        clientId: args.clientId ?? p.clientId ?? null,
      };
    });
    if (changed) {
      await db.communicationThread.update({
        where: { id: thread.id },
        data: { participants: next },
      });
      threadsUpdated += 1;
    }
  }

  let evidenceAttached = 0;
  if (args.clientId) {
    const messages = await db.communication.findMany({
      where: {
        deletedAt: null,
        thread: { workspaceId: args.workspaceId, deletedAt: null },
        OR: [
          { fromAddress: address },
          { toAddresses: { has: address } },
          { ccAddresses: { has: address } },
        ],
        evidenceItem: {
          deletedAt: null,
          clientId: null,
        },
      },
      select: {
        id: true,
        threadId: true,
        direction: true,
        sentAt: true,
        fromAddress: true,
        toAddresses: true,
        ccAddresses: true,
        evidenceItem: {
          select: {
            id: true,
            title: true,
            contentSha256: true,
            occurredAt: true,
          },
        },
      },
    });

    for (const message of messages) {
      await db.evidenceItem.update({
        where: { id: message.evidenceItem.id },
        data: { clientId: args.clientId },
      });
      evidenceAttached += 1;

      if (isEmailIntelligenceEnabled()) {
        const counterparties = [
          message.fromAddress,
          ...message.toAddresses,
          ...message.ccAddresses,
        ].filter((a) => normalizeParticipantAddress(a) !== address);

        await recordEmailCorrespondenceActivity({
          workspaceId: args.workspaceId,
          clientId: args.clientId,
          direction: message.direction,
          occurredAt: message.sentAt,
          title: message.evidenceItem.title,
          counterparties,
          evidenceItemId: message.evidenceItem.id,
          threadId: message.threadId,
          contentSha256: message.evidenceItem.contentSha256,
          fromTriage: true,
        });
      }
    }
  }

  return { threadsUpdated, evidenceAttached };
}
