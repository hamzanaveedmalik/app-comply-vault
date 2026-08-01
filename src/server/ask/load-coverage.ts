/**
 * Load IndexCoverageManifest from DB for a workspace (CV-AX-06 / CV-DM-01).
 * Falls back to demo defaults when none is seeded.
 */

import type { db as defaultDb } from "~/server/db";
import {
  DEMO_COVERAGE_DEFAULTS,
  type CoverageGap,
  type IndexCoverageManifest,
  type IndexedSourceRange,
} from "./coverage";

type PrismaLike = {
  indexCoverageManifest: {
    findFirst: (args: {
      where: Record<string, unknown>;
    }) => Promise<{
      workspaceId: string;
      sources: unknown;
      gapPeriods: unknown;
      unindexedSources: unknown;
      lastIndexedAt: Date | null;
    } | null>;
  };
};

function asSources(json: unknown): IndexedSourceRange[] {
  if (!Array.isArray(json)) return [];
  return json as IndexedSourceRange[];
}

function asGaps(json: unknown): CoverageGap[] {
  if (!Array.isArray(json)) return [];
  return json as CoverageGap[];
}

function asUnindexed(
  json: unknown
): IndexCoverageManifest["unindexedSources"] {
  if (!Array.isArray(json)) return DEMO_COVERAGE_DEFAULTS.unindexedSources;
  return json as IndexCoverageManifest["unindexedSources"];
}

export async function loadCoverageManifest(
  workspaceId: string,
  prisma?: PrismaLike
): Promise<IndexCoverageManifest> {
  const client =
    prisma ??
    ((await import("~/server/db")).db as unknown as PrismaLike);

  try {
    const row = await client.indexCoverageManifest.findFirst({
      where: { workspaceId, deletedAt: null },
    });
    if (!row) {
      return {
        workspaceId,
        sources: [],
        gapPeriods: DEMO_COVERAGE_DEFAULTS.gapPeriods,
        unindexedSources: DEMO_COVERAGE_DEFAULTS.unindexedSources,
        lastIndexedAt: null,
      };
    }
    return {
      workspaceId: row.workspaceId,
      sources: asSources(row.sources),
      gapPeriods: asGaps(row.gapPeriods).length
        ? asGaps(row.gapPeriods)
        : DEMO_COVERAGE_DEFAULTS.gapPeriods,
      unindexedSources: asUnindexed(row.unindexedSources),
      lastIndexedAt: row.lastIndexedAt?.toISOString() ?? null,
    };
  } catch {
    return {
      workspaceId,
      sources: [],
      gapPeriods: DEMO_COVERAGE_DEFAULTS.gapPeriods,
      unindexedSources: DEMO_COVERAGE_DEFAULTS.unindexedSources,
      lastIndexedAt: null,
    };
  }
}
