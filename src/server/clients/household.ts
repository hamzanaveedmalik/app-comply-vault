/**
 * Client household graph — spouse / joint holders share correspondence context.
 */

import { db } from "~/server/db";

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
