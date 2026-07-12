/**
 * Participant matching — exact address auto-link; fuzzy → triage queue.
 * Epic B CV-B-06
 */

import { db } from "~/server/db";
import { getValidZohoCrmContext } from "~/server/integrations/zoho/crm-token";
import { findContactIdByEmail } from "~/server/integrations/zoho/crm-api";

export type ParticipantMatch = {
  address: string;
  userId: string | null;
  clientId: string | null;
  verified: boolean;
  source: "alias" | "user" | "client" | "zoho" | "triage";
};

function normalizeAddress(addr: string): string {
  return addr.trim().toLowerCase();
}

export async function matchParticipantAddress(args: {
  workspaceId: string;
  address: string;
}): Promise<ParticipantMatch> {
  const address = normalizeAddress(args.address);

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
    return {
      address,
      userId: null,
      clientId: clientAlias.clientId,
      verified: true,
      source: "client",
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

export async function backfillParticipantLinks(args: {
  workspaceId: string;
  address: string;
  userId?: string | null;
  clientId?: string | null;
}): Promise<number> {
  const address = normalizeAddress(args.address);
  const threads = await db.communicationThread.findMany({
    where: {
      workspaceId: args.workspaceId,
      deletedAt: null,
    },
    select: { id: true, participants: true },
  });

  let updated = 0;
  for (const thread of threads) {
    const participants = thread.participants as Array<{
      address: string;
      userId?: string | null;
      clientId?: string | null;
    }>;
    let changed = false;
    const next = participants.map((p) => {
      if (normalizeAddress(p.address) !== address) return p;
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
      updated += 1;
    }
  }
  return updated;
}
