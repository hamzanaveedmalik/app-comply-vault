import type {
  DashboardSummary,
  FinalizeTimeData,
  FlagCategoryData,
  MeetingRow,
  MeetingTypeData,
  MeetingUiStatus,
  WeeklyFlagData,
} from "~/lib/dashboard-types";
import { dashboardColors } from "~/lib/dashboard-colors";
import type { FlagType, MeetingStatus } from "../../../generated/prisma";
import type { PrismaClient } from "../../../generated/prisma";

const OPEN_FLAG_STATUSES = ["OPEN", "IN_REMEDIATION", "PENDING_VERIFICATION"] as const;

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

const OPEN_FLAG_STATUS_SET = new Set<string>(OPEN_FLAG_STATUSES);

function formatWeekLabel(weekStart: Date, index: number): string {
  return `W${index + 1}`;
}

function mapFlagTypeToCategory(type: FlagType): keyof typeof dashboardColors.flagCategories {
  switch (type) {
    case "MISSING_SUITABILITY_BASIS":
      return "Suitability";
    case "MISSING_DISCLOSURE":
      return "Disclosure";
    case "CONFLICT_LANGUAGE":
      return "Documentation";
    default:
      return "Documentation";
  }
}

function resolveUiStatus(
  status: MeetingStatus,
  openFlagCount: number,
): MeetingUiStatus {
  if (status === "FINALIZED") return "finalized";
  if (status === "CCO_SIGNED_OFF") return "review";
  if (status === "CM_REVIEWED") return openFlagCount > 0 ? "flagged" : "review";
  if (status === "ADVISOR_CERTIFIED") return openFlagCount > 0 ? "flagged" : "review";
  if (openFlagCount > 0) return "flagged";
  if (status === "DRAFT_READY") return "review";
  if (status === "DRAFT") return "review";
  return "draft";
}

function resolveStatusLabel(status: MeetingStatus, ui: MeetingUiStatus): string {
  if (ui === "finalized") return "Finalized";
  if (ui === "flagged") return "Flagged";
  if (ui === "review") {
    if (status === "DRAFT_READY") return "Ready for Review";
    if (status === "ADVISOR_CERTIFIED") return "Advisor certified";
    if (status === "CM_REVIEWED") return "CM reviewed";
    if (status === "CCO_SIGNED_OFF") return "CCO signed off";
    return "In review";
  }
  if (status === "PROCESSING" || status === "UPLOADING") return "Processing";
  return "Draft";
}

function pipelineCategory(
  status: MeetingStatus,
  openFlagCount: number,
): "draft" | "review" | "flagged" | "finalized" {
  if (status === "FINALIZED") return "finalized";
  if (status === "CCO_SIGNED_OFF") return "review";
  if (status === "CM_REVIEWED") return openFlagCount > 0 ? "flagged" : "review";
  if (status === "ADVISOR_CERTIFIED") return openFlagCount > 0 ? "flagged" : "review";
  if (openFlagCount > 0) return "flagged";
  if (status === "DRAFT_READY" || status === "DRAFT") return "review";
  return "draft";
}

export async function buildDashboardSummary(
  db: PrismaClient,
  workspaceId: string,
): Promise<DashboardSummary> {
  const now = new Date();

  const [
    meetings,
    totalMeetings,
    finalizedCount,
    openFlagsCount,
    pendingReview,
    flagRows,
    allFlagsForResolve,
    exportsCount,
    timeToFinalizeRows,
  ] = await Promise.all([
    db.meeting.findMany({
      where: { workspaceId },
      select: {
        id: true,
        clientName: true,
        meetingType: true,
        meetingDate: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        flags: {
          where: { status: { in: [...OPEN_FLAG_STATUSES] } },
          select: { id: true },
        },
      },
      orderBy: { updatedAt: "desc" },
      take: 20,
    }),
    db.meeting.count({ where: { workspaceId } }),
    db.meeting.count({ where: { workspaceId, status: "FINALIZED" } }),
    db.flag.count({
      where: {
        workspaceId,
        status: { in: [...OPEN_FLAG_STATUSES] },
      },
    }),
    db.meeting.count({
      where: {
        workspaceId,
        status: { in: ["DRAFT_READY", "DRAFT"] },
      },
    }),
    db.flag.findMany({
      where: { workspaceId },
      select: { createdAt: true, type: true, status: true },
    }),
    db.flag.groupBy({
      by: ["status"],
      where: { workspaceId },
      _count: { id: true },
    }),
    db.auditEvent.count({
      where: {
        workspaceId,
        action: "EXPORT",
        resourceType: "meeting",
      },
    }),
    db.meeting.findMany({
      where: {
        workspaceId,
        status: "FINALIZED",
        timeToFinalize: { not: null },
      },
      select: { timeToFinalize: true, finalizedAt: true },
    }),
  ]);

  const twelveWeeksAgo = new Date(now.getTime() - 12 * WEEK_MS);
  const eightWeeksAgo = new Date(now.getTime() - 8 * WEEK_MS);

  const flagsInWindow = flagRows.filter((f) => f.createdAt >= twelveWeeksAgo);
  const weekBuckets: number[] = Array.from({ length: 12 }, () => 0);
  const weekStarts: Date[] = [];
  for (let i = 0; i < 12; i++) {
    weekStarts.push(new Date(twelveWeeksAgo.getTime() + i * WEEK_MS));
  }

  for (const f of flagsInWindow) {
    const idx = Math.min(
      11,
      Math.max(
        0,
        Math.floor((f.createdAt.getTime() - twelveWeeksAgo.getTime()) / WEEK_MS),
      ),
    );
    weekBuckets[idx] = (weekBuckets[idx] ?? 0) + 1;
  }

  const flagsTrend: WeeklyFlagData[] = weekBuckets.map((count, i) => ({
    week: formatWeekLabel(weekStarts[i]!, i),
    count,
  }));

  const lastWeekCount = weekBuckets[11] ?? 0;
  const prevWeekCount = weekBuckets[10] ?? 0;
  const flagsDelta = lastWeekCount - prevWeekCount;
  let flagsTrending: "up" | "down" | "flat" = "flat";
  if (flagsDelta > 0) flagsTrending = "up";
  else if (flagsDelta < 0) flagsTrending = "down";

  const categoryMap = new Map<string, number>();
  for (const cat of Object.keys(dashboardColors.flagCategories)) {
    categoryMap.set(cat, 0);
  }
  for (const f of flagRows) {
    if (!OPEN_FLAG_STATUS_SET.has(f.status)) continue;
    const label = mapFlagTypeToCategory(f.type);
    categoryMap.set(label, (categoryMap.get(label) ?? 0) + 1);
  }
  const flagsByCategory: FlagCategoryData[] = Array.from(categoryMap.entries())
    .filter(([, count]) => count > 0)
    .map(([category, count]) => ({
      category,
      count,
      color: dashboardColors.flagCategories[category as keyof typeof dashboardColors.flagCategories] ?? "#94A3B8",
    }))
    .sort((a, b) => b.count - a.count);

  if (flagsByCategory.length === 0) {
    flagsByCategory.push({
      category: "Suitability",
      count: 0,
      color: dashboardColors.flagCategories["Suitability"] ?? "#EF4444",
    });
  }

  const allMeetingsForTypes = await db.meeting.findMany({
    where: { workspaceId },
    select: { meetingType: true },
  });
  const typeCount = new Map<string, number>();
  for (const m of allMeetingsForTypes) {
    const t = m.meetingType.trim() || "Other";
    typeCount.set(t, (typeCount.get(t) ?? 0) + 1);
  }
  const meetingsByType: MeetingTypeData[] = Array.from(typeCount.entries())
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count);

  const finalizeBuckets: { sumDays: number; n: number }[] = Array.from({ length: 8 }, () => ({
    sumDays: 0,
    n: 0,
  }));
  for (const row of timeToFinalizeRows) {
    if (!row.finalizedAt || row.timeToFinalize == null) continue;
    if (row.finalizedAt < eightWeeksAgo) continue;
    const idx = Math.min(
      7,
      Math.max(
        0,
        Math.floor((row.finalizedAt.getTime() - eightWeeksAgo.getTime()) / WEEK_MS),
      ),
    );
    const days = row.timeToFinalize / 86400;
    const b = finalizeBuckets[idx]!;
    b.sumDays += days;
    b.n += 1;
  }
  const monthDayFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });
  const finalizeTrend: FinalizeTimeData[] = finalizeBuckets.map((b, i) => {
    const weekStart = new Date(eightWeeksAgo.getTime() + i * WEEK_MS);
    return {
      date: monthDayFmt.format(weekStart),
      days: b.n === 0 ? null : b.sumDays / b.n,
    };
  });

  let avgTimeToFinalize: number | null = null;
  if (timeToFinalizeRows.length > 0) {
    const vals = timeToFinalizeRows.map((r) => (r.timeToFinalize ?? 0) / 86400);
    avgTimeToFinalize = vals.reduce((a, b) => a + b, 0) / vals.length;
  }

  const unfinalizedCount = await db.meeting.count({
    where: { workspaceId, status: { not: "FINALIZED" } },
  });

  const allForPipeline = await db.meeting.findMany({
    where: { workspaceId },
    select: {
      status: true,
      flags: {
        where: { status: { in: [...OPEN_FLAG_STATUSES] } },
        select: { id: true },
      },
    },
  });

  const pipeline = { draft: 0, review: 0, flagged: 0, finalized: 0 };
  for (const m of allForPipeline) {
    const open = m.flags.length;
    const cat = pipelineCategory(m.status, open);
    pipeline[cat] += 1;
  }

  const pastProcessing = await db.meeting.count({
    where: {
      workspaceId,
      status: { notIn: ["UPLOADING", "PROCESSING"] },
    },
  });
  const meetingCoverage =
    totalMeetings === 0 ? 100 : Math.round((pastProcessing / totalMeetings) * 100);
  const documentsFinalised =
    totalMeetings === 0 ? 100 : Math.round((finalizedCount / totalMeetings) * 100);

  let closedFlags = 0;
  let openResolvedDenominator = 0;
  for (const g of allFlagsForResolve) {
    const c = g._count.id;
    openResolvedDenominator += c;
    if (g.status === "CLOSED" || g.status === "CLOSED_ACCEPTED_RISK") {
      closedFlags += c;
    }
  }
  const flagsResolved =
    openResolvedDenominator === 0
      ? 100
      : Math.round((closedFlags / openResolvedDenominator) * 100);

  const finalizedWithPath = await db.meeting.count({
    where: {
      workspaceId,
      status: "FINALIZED",
      OR: [{ readyForCCO: true }, { draftReadyAt: { not: null } }],
    },
  });
  const signaturesComplete =
    finalizedCount === 0
      ? 100
      : Math.round((finalizedWithPath / finalizedCount) * 100);

  const healthScore = Math.round(
    meetingCoverage * 0.3 +
      documentsFinalised * 0.25 +
      flagsResolved * 0.25 +
      signaturesComplete * 0.2,
  );

  const recentMeetings: MeetingRow[] = meetings.map((m) => {
    const openCount = m.flags.length;
    const ui = resolveUiStatus(m.status, openCount);
    return {
      id: m.id,
      clientName: m.clientName,
      meetingType: m.meetingType,
      date: m.meetingDate.toISOString(),
      status: ui,
      statusLabel: resolveStatusLabel(m.status, ui),
      rawStatus: m.status,
      flagCount: openCount,
    };
  });

  const finalizationRate =
    totalMeetings === 0 ? 100 : Math.round((finalizedCount / totalMeetings) * 100);

  return {
    healthScore: Math.max(0, Math.min(100, healthScore)),
    healthBreakdown: {
      meetingCoverage,
      documentsFinalised,
      flagsResolved,
      signaturesComplete,
    },
    totalMeetings,
    pendingReview,
    openFlags: openFlagsCount,
    unfinalizedCount,
    flagsDelta,
    flagsTrending,
    finalizationRate,
    finalizedCount,
    avgTimeToFinalize,
    auditPacksGenerated: exportsCount,
    pipeline,
    flagsTrend,
    flagsByCategory,
    meetingsByType,
    finalizeTrend,
    recentMeetings,
  };
}
