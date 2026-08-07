import type { PrismaClient } from "../../../generated/prisma";
import type {
  FirmSupervisionRow,
  PortfolioSupervisionSummary,
  SupervisionCounts,
  SupervisionPatternDto,
} from "~/lib/types";
import { activeUserWorkspaceWhere } from "~/lib/user-workspace-filters";
import {
  ADVIZORSTACK_EXPECTED_COUNTS,
  ADVIZORSTACK_FIRMS,
  ADVIZORSTACK_ONBOARDING_TYPE,
  ADVIZORSTACK_PRIMARY_FINDING,
  isAdvizorStackFirmWorkspaceId,
} from "~/server/supervision/advizorstack-tenant";
import { getSupervisionSummary } from "~/server/supervision/service";

function emptyCounts(): SupervisionCounts {
  return {
    totalProcessed: 0,
    clearedOrDeprioritised: 0,
    routineSamples: 0,
    priorityFindings: 0,
    heldInteractions: 0,
    openRemediation: 0,
  };
}

function sumCounts(parts: SupervisionCounts[]): SupervisionCounts {
  return parts.reduce<SupervisionCounts>(
    (acc, part) => ({
      totalProcessed: acc.totalProcessed + part.totalProcessed,
      clearedOrDeprioritised: acc.clearedOrDeprioritised + part.clearedOrDeprioritised,
      routineSamples: acc.routineSamples + part.routineSamples,
      priorityFindings: acc.priorityFindings + part.priorityFindings,
      heldInteractions: acc.heldInteractions + part.heldInteractions,
      openRemediation: acc.openRemediation + part.openRemediation,
    }),
    emptyCounts(),
  );
}

function buildSelectivityStatement(priorityFindings: number, totalProcessed: number): string {
  const findingLabel = priorityFindings === 1 ? "finding" : "findings";
  const interactionLabel = totalProcessed === 1 ? "interaction" : "interactions";
  return `${priorityFindings} ${findingLabel} require review from ${totalProcessed} processed ${interactionLabel}.`;
}

/**
 * Returns AdvizorStack firm workspace IDs the user is allowed to see.
 * Never returns firms outside the caller's memberships.
 */
export async function listAuthorisedFirmWorkspaceIds(
  db: PrismaClient,
  userId: string,
  firmIdFilter?: string,
): Promise<string[]> {
  const memberships = await db.userWorkspace.findMany({
    where: {
      userId,
      ...activeUserWorkspaceWhere,
      workspace: {
        onboardingType: ADVIZORSTACK_ONBOARDING_TYPE,
      },
    },
    select: { workspaceId: true },
  });

  let ids = memberships
    .map((row) => row.workspaceId)
    .filter((id) => isAdvizorStackFirmWorkspaceId(id));

  // Fallback: known firm IDs the user belongs to (covers older seeds without onboardingType).
  if (ids.length === 0) {
    const known = await db.userWorkspace.findMany({
      where: {
        userId,
        workspaceId: { in: ADVIZORSTACK_FIRMS.map((f) => f.workspaceId) },
        ...activeUserWorkspaceWhere,
      },
      select: { workspaceId: true },
    });
    ids = known.map((row) => row.workspaceId);
  }

  if (firmIdFilter) {
    if (!ids.includes(firmIdFilter)) {
      return [];
    }
    return [firmIdFilter];
  }

  return ids;
}

async function buildFirmRow(
  db: PrismaClient,
  workspaceId: string,
  summaryCounts: SupervisionCounts,
): Promise<FirmSupervisionRow> {
  const firm = ADVIZORSTACK_FIRMS.find((f) => f.workspaceId === workspaceId);
  const workspace = await db.workspace.findUnique({
    where: { id: workspaceId },
    select: { name: true },
  });

  const openFlags = await db.flag.findMany({
    where: {
      workspaceId,
      status: { in: ["OPEN", "IN_REMEDIATION", "PENDING_VERIFICATION"] },
    },
    select: { type: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  const controlCounts = new Map<string, number>();
  for (const flag of openFlags) {
    controlCounts.set(flag.type, (controlCounts.get(flag.type) ?? 0) + 1);
  }
  let topControlConcern: string | null = null;
  let topCount = 0;
  for (const [control, count] of controlCounts) {
    if (count > topCount) {
      topControlConcern = control;
      topCount = count;
    }
  }

  const rolloverOpen = openFlags.filter((f) => f.type === "MISSING_DISCLOSURE").length;

  return {
    firmId: workspaceId,
    firmName: workspace?.name ?? firm?.name ?? workspaceId,
    processedInteractions: summaryCounts.totalProcessed,
    priorityFindings: summaryCounts.priorityFindings,
    openRemediation: summaryCounts.openRemediation,
    oldestUnresolvedFindingAt: openFlags[0]?.createdAt.toISOString() ?? null,
    topControlConcern,
    trend: rolloverOpen >= 2 ? "increasing" : summaryCounts.priorityFindings > 0 ? "stable" : "insufficient_data",
    coverageStatus: summaryCounts.totalProcessed > 0 ? "covered" : "gap",
    href: `/firms/${workspaceId}/supervision`,
  };
}

async function buildPatterns(
  db: PrismaClient,
  firmIds: string[],
): Promise<SupervisionPatternDto[]> {
  if (firmIds.length === 0) return [];

  const rolloverFlags = await db.flag.findMany({
    where: {
      workspaceId: { in: firmIds },
      type: "MISSING_DISCLOSURE",
      status: { in: ["OPEN", "IN_REMEDIATION", "PENDING_VERIFICATION", "CLOSED"] },
    },
    select: { workspaceId: true, status: true },
  });

  const firmsAffected = new Set(rolloverFlags.map((f) => f.workspaceId)).size;
  const openFindings = rolloverFlags.filter((f) =>
    ["OPEN", "IN_REMEDIATION", "PENDING_VERIFICATION"].includes(f.status),
  ).length;

  const patterns: SupervisionPatternDto[] = [];
  if (rolloverFlags.length >= 2) {
    patterns.push({
      id: "pattern-rollover-documentation",
      title: "Rollover documentation weakness",
      summary: `${rolloverFlags.length} rollover-documentation findings across ${firmsAffected} firms. Human review required — ComplyVault does not independently determine a violation.`,
      controlArea: "MISSING_DISCLOSURE",
      firmsAffected,
      openFindings,
      href: `/priority-inbox?control=MISSING_DISCLOSURE&finding=${ADVIZORSTACK_PRIMARY_FINDING.flagId}`,
    });
  }

  const perf = await db.flag.count({
    where: {
      workspaceId: { in: firmIds },
      type: "PERFORMANCE_CLAIM",
      status: { in: ["OPEN", "IN_REMEDIATION", "PENDING_VERIFICATION"] },
    },
  });
  if (perf > 0) {
    patterns.push({
      id: "pattern-performance-language",
      title: "Unsupported performance language",
      summary: `${perf} open performance-language triage signal(s) require human review.`,
      controlArea: "PERFORMANCE_CLAIM",
      firmsAffected: 1,
      openFindings: perf,
      href: "/priority-inbox?control=PERFORMANCE_CLAIM",
    });
  }

  const fee = await db.flag.count({
    where: {
      workspaceId: { in: firmIds },
      type: "FEE_DISPUTE",
      status: { in: ["OPEN", "IN_REMEDIATION", "PENDING_VERIFICATION"] },
    },
  });
  if (fee > 0) {
    patterns.push({
      id: "pattern-fee-disclosure",
      title: "Fee-disclosure inconsistency",
      summary: `${fee} open fee-disclosure triage signal(s) require human review.`,
      controlArea: "FEE_DISPUTE",
      firmsAffected: 1,
      openFindings: fee,
      href: "/priority-inbox?control=FEE_DISPUTE",
    });
  }

  return patterns.slice(0, 3);
}

export type PortfolioSupervisionFilters = {
  firmId?: string;
  dateFrom?: Date;
  dateTo?: Date;
};

export async function getPortfolioSupervisionSummary(
  db: PrismaClient,
  userId: string,
  filters: PortfolioSupervisionFilters = {},
): Promise<PortfolioSupervisionSummary> {
  const firmIds = await listAuthorisedFirmWorkspaceIds(db, userId, filters.firmId);

  if (firmIds.length === 0) {
    return {
      synthetic: false,
      counts: emptyCounts(),
      selectivityStatement: buildSelectivityStatement(0, 0),
      firms: [],
      patterns: [],
    };
  }

  const perFirm = await Promise.all(
    firmIds.map(async (workspaceId) => {
      const summary = await getSupervisionSummary(db, workspaceId, {
        dateFrom: filters.dateFrom,
        dateTo: filters.dateTo,
        firmId: workspaceId,
      });
      const row = await buildFirmRow(db, workspaceId, summary.counts);
      return { summary, row };
    }),
  );

  const counts = sumCounts(perFirm.map((part) => part.summary.counts));
  const patterns = await buildPatterns(db, firmIds);

  return {
    synthetic: firmIds.every((id) => isAdvizorStackFirmWorkspaceId(id)),
    counts,
    selectivityStatement: buildSelectivityStatement(
      counts.priorityFindings,
      counts.totalProcessed,
    ),
    firms: perFirm.map((part) => part.row),
    patterns,
  };
}

export const portfolioTestHelpers = {
  sumCounts,
  emptyCounts,
  buildSelectivityStatement,
  expectedSeededPortfolioCounts: ADVIZORSTACK_EXPECTED_COUNTS,
};
