/**
 * CV-TR-17 — Supersession chain chronology for exam / audit packs.
 * Presents one logical record with dated versions, not independent interactions.
 */

import { db } from "~/server/db";

export type SupersessionChainEntry = {
  meetingId: string;
  meetingDate: string;
  status: string;
  sealedAt: string | null;
  sealId: string | null;
  packHash: string | null;
  supersedeReason: string | null;
  /** Position in chain: 1 = earliest (original). */
  versionIndex: number;
  isCurrent: boolean;
};

export type SupersessionChainDto = {
  /** Chronological versions (oldest first). */
  versions: SupersessionChainEntry[];
  /** Human narrative blocks between versions for pack rendering. */
  chronologyLines: string[];
};

/**
 * Walk supersedesId links to the root, then walk supersededById to the tip.
 */
export async function resolveSupersessionChain(args: {
  meetingId: string;
  workspaceId: string;
}): Promise<SupersessionChainDto | null> {
  const seed = await db.meeting.findFirst({
    where: { id: args.meetingId, workspaceId: args.workspaceId },
    select: {
      id: true,
      supersedesId: true,
      supersededById: true,
    },
  });
  if (!seed) return null;
  if (!seed.supersedesId && !seed.supersededById) {
    return null;
  }

  // Walk to root (original)
  let rootId = seed.id;
  const seen = new Set<string>([rootId]);
  let cursor: string | null = seed.supersedesId;
  while (cursor) {
    if (seen.has(cursor)) break;
    seen.add(cursor);
    rootId = cursor;
    const parent: { supersedesId: string | null } | null =
      await db.meeting.findFirst({
        where: { id: cursor, workspaceId: args.workspaceId },
        select: { supersedesId: true },
      });
    cursor = parent?.supersedesId ?? null;
  }

  // Walk forward via supersededById
  const orderedIds: string[] = [rootId];
  let nextId: string | null = null;
  const rootRow: { supersededById: string | null } | null =
    await db.meeting.findFirst({
      where: { id: rootId, workspaceId: args.workspaceId },
      select: { supersededById: true },
    });
  nextId = rootRow?.supersededById ?? null;
  while (nextId) {
    if (orderedIds.includes(nextId)) break;
    orderedIds.push(nextId);
    const row: { supersededById: string | null } | null =
      await db.meeting.findFirst({
        where: { id: nextId, workspaceId: args.workspaceId },
        select: { supersededById: true },
      });
    nextId = row?.supersededById ?? null;
  }

  const meetings = await db.meeting.findMany({
    where: { id: { in: orderedIds }, workspaceId: args.workspaceId },
    include: {
      recordSeals: {
        orderBy: { sealedAt: "asc" },
        take: 1,
      },
    },
  });
  const byId = new Map(meetings.map((m) => [m.id, m]));

  const tipId = orderedIds[orderedIds.length - 1]!;
  const versions: SupersessionChainEntry[] = [];
  for (let i = 0; i < orderedIds.length; i++) {
    const id = orderedIds[i]!;
    const m = byId.get(id);
    if (!m) continue;
    const seal = m.recordSeals[0] ?? null;
    versions.push({
      meetingId: m.id,
      meetingDate: m.meetingDate.toISOString(),
      status: m.status,
      sealedAt: seal?.sealedAt.toISOString() ?? null,
      sealId: seal?.id ?? null,
      packHash: seal?.packHash ?? null,
      supersedeReason: m.supersedeReason,
      versionIndex: i + 1,
      isCurrent: m.id === tipId,
    });
  }

  const chronologyLines: string[] = [];
  chronologyLines.push(
    "Supersession chain (one logical record; versions in chronological order):",
  );
  for (let i = 0; i < versions.length; i++) {
    const v = versions[i]!;
    const sealPart = v.sealId
      ? `seal ${v.sealId}` + (v.sealedAt ? ` at ${v.sealedAt}` : "")
      : "not yet sealed";
    chronologyLines.push(
      `Version ${v.versionIndex}: meeting ${v.meetingId} (${v.status}); ${sealPart}.${v.isCurrent ? " [current]" : ""}`,
    );
    const next = versions[i + 1];
    if (next) {
      const reason =
        next.supersedeReason?.trim() ||
        v.supersedeReason?.trim() ||
        "(reason not recorded)";
      chronologyLines.push(`  → Superseded: ${reason}`);
    }
  }

  return { versions, chronologyLines };
}

/**
 * Plain-text section for audit / exam pack inclusion.
 */
export function formatSupersessionChainForPack(
  chain: SupersessionChainDto,
): string {
  return chain.chronologyLines.join("\n") + "\n";
}
