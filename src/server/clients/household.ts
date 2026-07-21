/**
 * Client household graph — spouse / joint holders share correspondence context.
 * Mutations soft-delete only; never detach historical EvidenceItem / ClientActivity.
 */

import { db } from "~/server/db";
import type { HouseholdMemberRole } from "../../../generated/prisma";
import {
  backfillParticipantLinks,
  countHistoricalThreadsForAddress,
  normalizeParticipantAddress,
  upsertVerifiedAlias,
} from "~/server/mailbox/participant-matching";

/**
 * Returns the given client id plus every non-deleted household peer in the same workspace.
 */
export async function getHouseholdClientIds(args: {
  workspaceId: string;
  clientId: string;
}): Promise<string[]> {
  const memberships = await db.clientHouseholdMember.findMany({
    where: {
      clientId: args.clientId,
      deletedAt: null,
      household: {
        workspaceId: args.workspaceId,
        deletedAt: null,
      },
    },
    select: { householdId: true },
  });

  if (memberships.length === 0) {
    return [args.clientId];
  }

  const householdIds = [...new Set(memberships.map((m) => m.householdId))];
  const peers = await db.clientHouseholdMember.findMany({
    where: {
      householdId: { in: householdIds },
      deletedAt: null,
      client: {
        workspaceId: args.workspaceId,
        deletedAt: null,
      },
    },
    select: { clientId: true },
  });

  return [...new Set([args.clientId, ...peers.map((p) => p.clientId)])];
}

/**
 * Given any matched client id, also return ids of household members whose
 * EmailAlias addresses should count as "known" for that household.
 * Used when expanding match candidates (multi-person households).
 */
export async function getClientIdsSharingHousehold(args: {
  workspaceId: string;
  clientIds: string[];
}): Promise<string[]> {
  if (args.clientIds.length === 0) return [];
  const sets = await Promise.all(
    args.clientIds.map((clientId) =>
      getHouseholdClientIds({ workspaceId: args.workspaceId, clientId })
    )
  );
  return [...new Set(sets.flat())];
}

async function assertClientInWorkspace(args: {
  workspaceId: string;
  clientId: string;
}): Promise<boolean> {
  const client = await db.client.findFirst({
    where: {
      id: args.clientId,
      workspaceId: args.workspaceId,
      deletedAt: null,
    },
    select: { id: true },
  });
  return Boolean(client);
}

/**
 * Ensure the client has a household; create one with PRIMARY membership if needed.
 */
export async function ensureHouseholdForClient(args: {
  workspaceId: string;
  clientId: string;
}): Promise<string> {
  const existing = await db.clientHouseholdMember.findFirst({
    where: {
      clientId: args.clientId,
      deletedAt: null,
      household: { workspaceId: args.workspaceId, deletedAt: null },
    },
    select: { householdId: true },
  });
  if (existing) return existing.householdId;

  const household = await db.clientHousehold.create({
    data: {
      workspaceId: args.workspaceId,
      members: {
        create: {
          clientId: args.clientId,
          role: "PRIMARY",
        },
      },
    },
    select: { id: true },
  });
  return household.id;
}

export async function linkClientToHousehold(args: {
  workspaceId: string;
  anchorClientId: string;
  peerClientId: string;
  role: HouseholdMemberRole;
  userId: string;
}): Promise<{ success: true; membershipId: string } | { success: false; error: string }> {
  if (args.anchorClientId === args.peerClientId) {
    return { success: false, error: "Cannot link a client to itself" };
  }
  const ok =
    (await assertClientInWorkspace({
      workspaceId: args.workspaceId,
      clientId: args.anchorClientId,
    })) &&
    (await assertClientInWorkspace({
      workspaceId: args.workspaceId,
      clientId: args.peerClientId,
    }));
  if (!ok) return { success: false, error: "Client not found" };

  const householdId = await ensureHouseholdForClient({
    workspaceId: args.workspaceId,
    clientId: args.anchorClientId,
  });

  const already = await db.clientHouseholdMember.findFirst({
    where: {
      householdId,
      clientId: args.peerClientId,
      deletedAt: null,
    },
    select: { id: true },
  });
  if (already) {
    return { success: false, error: "Client is already in this household" };
  }

  const membership = await db.clientHouseholdMember.create({
    data: {
      householdId,
      clientId: args.peerClientId,
      role: args.role,
    },
  });

  await db.auditEvent.create({
    data: {
      workspaceId: args.workspaceId,
      userId: args.userId,
      action: "EDIT",
      resourceType: "client_household",
      resourceId: householdId,
      metadata: {
        action: "household_member_linked",
        membershipId: membership.id,
        peerClientId: args.peerClientId,
        role: args.role,
      },
    },
  });

  return { success: true, membershipId: membership.id };
}

export async function createHouseholdMember(args: {
  workspaceId: string;
  anchorClientId: string;
  name: string;
  role: HouseholdMemberRole;
  userId: string;
}): Promise<{ success: true; clientId: string; membershipId: string } | { success: false; error: string }> {
  const name = args.name.trim();
  if (!name) return { success: false, error: "Name is required" };

  const ok = await assertClientInWorkspace({
    workspaceId: args.workspaceId,
    clientId: args.anchorClientId,
  });
  if (!ok) return { success: false, error: "Client not found" };

  const householdId = await ensureHouseholdForClient({
    workspaceId: args.workspaceId,
    clientId: args.anchorClientId,
  });

  const result = await db.$transaction(async (tx) => {
    const client = await tx.client.create({
      data: {
        workspaceId: args.workspaceId,
        name,
        status: "CLIENT",
      },
    });
    const membership = await tx.clientHouseholdMember.create({
      data: {
        householdId,
        clientId: client.id,
        role: args.role,
      },
    });
    await tx.auditEvent.create({
      data: {
        workspaceId: args.workspaceId,
        userId: args.userId,
        action: "EDIT",
        resourceType: "client_household",
        resourceId: householdId,
        metadata: {
          action: "household_member_created",
          membershipId: membership.id,
          peerClientId: client.id,
          role: args.role,
        },
      },
    });
    return { clientId: client.id, membershipId: membership.id };
  });

  return { success: true, ...result };
}

export async function updateHouseholdMemberRole(args: {
  workspaceId: string;
  membershipId: string;
  role: HouseholdMemberRole;
  userId: string;
}): Promise<{ success: true } | { success: false; error: string }> {
  const membership = await db.clientHouseholdMember.findFirst({
    where: {
      id: args.membershipId,
      deletedAt: null,
      household: { workspaceId: args.workspaceId, deletedAt: null },
    },
    select: { id: true, householdId: true },
  });
  if (!membership) return { success: false, error: "Membership not found" };

  await db.$transaction([
    db.clientHouseholdMember.update({
      where: { id: membership.id },
      data: { role: args.role },
    }),
    db.auditEvent.create({
      data: {
        workspaceId: args.workspaceId,
        userId: args.userId,
        action: "EDIT",
        resourceType: "client_household",
        resourceId: membership.householdId,
        metadata: {
          action: "household_member_role_updated",
          membershipId: membership.id,
          role: args.role,
        },
      },
    }),
  ]);

  return { success: true };
}

/**
 * Soft-remove a household member. Does NOT detach historical correspondence.
 */
export async function removeHouseholdMember(args: {
  workspaceId: string;
  membershipId: string;
  userId: string;
}): Promise<{ success: true } | { success: false; error: string }> {
  const membership = await db.clientHouseholdMember.findFirst({
    where: {
      id: args.membershipId,
      deletedAt: null,
      household: { workspaceId: args.workspaceId, deletedAt: null },
    },
    select: { id: true, householdId: true, clientId: true, role: true },
  });
  if (!membership) return { success: false, error: "Membership not found" };
  if (membership.role === "PRIMARY") {
    return {
      success: false,
      error: "Cannot remove the primary household member",
    };
  }

  await db.$transaction([
    db.clientHouseholdMember.update({
      where: { id: membership.id },
      data: { deletedAt: new Date() },
    }),
    db.auditEvent.create({
      data: {
        workspaceId: args.workspaceId,
        userId: args.userId,
        action: "EDIT",
        resourceType: "client_household",
        resourceId: membership.householdId,
        metadata: {
          action: "household_member_removed",
          membershipId: membership.id,
          peerClientId: membership.clientId,
        },
      },
    }),
  ]);

  return { success: true };
}

export async function previewAliasHistoricalThreads(args: {
  workspaceId: string;
  address: string;
}): Promise<number> {
  const address = normalizeParticipantAddress(args.address);
  if (!address.includes("@")) return 0;
  return countHistoricalThreadsForAddress({
    workspaceId: args.workspaceId,
    address,
  });
}

/**
 * Add a verified email alias to a client and retroactively attach historical threads.
 */
export async function addClientEmailAlias(args: {
  workspaceId: string;
  clientId: string;
  address: string;
  userId: string;
}): Promise<
  | {
      success: true;
      data: { threadsUpdated: number; evidenceAttached: number };
    }
  | { success: false; error: string }
> {
  const address = normalizeParticipantAddress(args.address);
  if (!address.includes("@")) {
    return { success: false, error: "Invalid email address" };
  }

  const ok = await assertClientInWorkspace({
    workspaceId: args.workspaceId,
    clientId: args.clientId,
  });
  if (!ok) return { success: false, error: "Client not found" };

  await upsertVerifiedAlias({
    workspaceId: args.workspaceId,
    address,
    userId: null,
    clientId: args.clientId,
  });

  // Resolve any pending triage for this address.
  await db.emailTriageItem.updateMany({
    where: {
      workspaceId: args.workspaceId,
      address,
      status: "PENDING",
    },
    data: {
      status: "CONFIRMED",
      clientId: args.clientId,
      resolvedBy: args.userId,
      resolvedAt: new Date(),
    },
  });

  const backfill = await backfillParticipantLinks({
    workspaceId: args.workspaceId,
    address,
    clientId: args.clientId,
  });

  await db.auditEvent.create({
    data: {
      workspaceId: args.workspaceId,
      userId: args.userId,
      action: "EDIT",
      resourceType: "client",
      resourceId: args.clientId,
      metadata: {
        action: "client_email_alias_added",
        threadsUpdated: backfill.threadsUpdated,
        evidenceAttached: backfill.evidenceAttached,
      },
    },
  });

  return { success: true, data: backfill };
}

/**
 * Soft-delete an alias. Historical correspondence stays attached; future mail will not auto-match.
 */
export async function removeClientEmailAlias(args: {
  workspaceId: string;
  aliasId: string;
  userId: string;
}): Promise<{ success: true } | { success: false; error: string }> {
  const alias = await db.emailAlias.findFirst({
    where: {
      id: args.aliasId,
      workspaceId: args.workspaceId,
      deletedAt: null,
    },
    select: { id: true, clientId: true },
  });
  if (!alias) return { success: false, error: "Alias not found" };

  await db.$transaction([
    db.emailAlias.update({
      where: { id: alias.id },
      data: { deletedAt: new Date() },
    }),
    db.auditEvent.create({
      data: {
        workspaceId: args.workspaceId,
        userId: args.userId,
        action: "EDIT",
        resourceType: "client",
        resourceId: alias.clientId ?? alias.id,
        metadata: {
          action: "client_email_alias_removed",
          aliasId: alias.id,
        },
      },
    }),
  ]);

  return { success: true };
}
