import type {
  ClientHealthRow,
  DashboardRange,
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
import { isEmailIntelligenceEnabled } from "~/lib/feature-flags";
import { getEmailLastContactByClientName } from "~/server/clients/queries";

const OPEN_FLAG_STATUSES = ["OPEN", "IN_REMEDIATION", "PENDING_VERIFICATION"] as const;

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

const OPEN_FLAG_STATUS_SET = new Set<string>(OPEN_FLAG_STATUSES);

/**
 * Per-range configuration for time-windowed cards. `days` is the lookback
 * window; the chart cards bucket that window into `trendPoints` / `activityPoints`
 * evenly-sized intervals so they render consistently at any range.
 */
const RANGE_CONFIG: Record<
  DashboardRange,
  {
    days: number;
    trendPoints: number;
    activityPoints: number;
    rangeLabel: string;
    granularity: "day" | "month";
  }
> = {
  "30d": { days: 30, trendPoints: 10, activityPoints: 6, rangeLabel: "Last 30 days", granularity: "day" },
  "90d": { days: 90, trendPoints: 12, activityPoints: 9, rangeLabel: "Last 90 days", granularity: "day" },
  "12m": { days: 365, trendPoints: 12, activityPoints: 12, rangeLabel: "Last 12 months", granularity: "month" },
};

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
    case "GUARANTEED_RETURN":
    case "PERFORMANCE_CLAIM":
    case "UNAPPROVED_MARKETING":
      return "Documentation";
    case "CLIENT_COMPLAINT":
    case "FEE_DISPUTE":
      return "Suitability";
    case "TRADE_INSTRUCTION":
    case "OFF_CHANNEL_REFERENCE":
    case "SENSITIVE_PII_SHARE":
    case "GIFTS_ENTERTAINMENT":
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
  range: DashboardRange = "90d",
): Promise<DashboardSummary> {
  const now = new Date();
  const rangeCfg = RANGE_CONFIG[range];
  const windowMs = rangeCfg.days * DAY_MS;
  const windowStart = new Date(now.getTime() - windowMs);

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
      select: {
        createdAt: true,
        type: true,
        status: true,
        resolvedAt: true,
        resolutionType: true,
        cmDisposition: true,
      },
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
      select: { id: true, clientName: true, timeToFinalize: true, finalizedAt: true },
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

  const boundedHealth = Math.max(0, Math.min(100, healthScore));
  const healthLabel =
    boundedHealth <= 39 ? "Critical" : boundedHealth <= 69 ? "Needs Attention" : "Healthy";

  // ── Per-client rollup (drives Clients table, audit readiness, coverage) ──
  const clientMeetingRows = await db.meeting.findMany({
    where: { workspaceId },
    select: {
      clientName: true,
      status: true,
      meetingDate: true,
      createdAt: true,
      finalizedAt: true,
      flags: {
        where: { status: { in: [...OPEN_FLAG_STATUSES] } },
        select: { createdAt: true },
      },
    },
  });

  const SLA_DAYS = 7;
  const TARGET_DAYS = 2;
  // Dispositions use the selected range as the current window and the immediately
  // preceding window of the same length for the trend comparison.
  const dispCurrentStart = windowStart;
  const dispPriorStart = new Date(now.getTime() - 2 * windowMs);

  // ── Flag aging (open flags only) ──
  let aging0to2 = 0;
  let aging3to7 = 0;
  let aging7plus = 0;
  let ageSum = 0;
  let ageN = 0;
  for (const f of flagRows) {
    if (!OPEN_FLAG_STATUS_SET.has(f.status)) continue;
    const ageDays = (now.getTime() - f.createdAt.getTime()) / DAY_MS;
    ageSum += ageDays;
    ageN += 1;
    if (ageDays <= 2) aging0to2 += 1;
    else if (ageDays <= SLA_DAYS) aging3to7 += 1;
    else aging7plus += 1;
  }
  const flagAging = {
    avgDaysOpen: ageN === 0 ? null : Math.round((ageSum / ageN) * 10) / 10,
    slaDays: SLA_DAYS,
    pastSla: aging7plus,
    buckets: [
      { label: "0–2d", count: aging0to2, color: dashboardColors.accent },
      { label: "3–7d", count: aging3to7, color: dashboardColors.amber2 },
      { label: "7d+", count: aging7plus, color: dashboardColors.red },
    ],
  };

  // ── Flag activity: opened vs resolved, bucketed across the selected range ──
  const activityPoints = rangeCfg.activityPoints;
  const activityStart = windowStart;
  const activityBucketMs = windowMs / activityPoints;
  const dayLabelFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });
  const monthLabelFmt = new Intl.DateTimeFormat("en-US", { month: "short" });
  const bucketLabelFmt = rangeCfg.granularity === "month" ? monthLabelFmt : dayLabelFmt;
  const openedByBucket: number[] = Array.from({ length: activityPoints }, () => 0);
  const resolvedByBucket: number[] = Array.from({ length: activityPoints }, () => 0);
  const bucketIndex = (d: Date): number =>
    Math.min(
      activityPoints - 1,
      Math.max(0, Math.floor((d.getTime() - activityStart.getTime()) / activityBucketMs)),
    );
  for (const f of flagRows) {
    if (f.createdAt >= activityStart) {
      const idx = bucketIndex(f.createdAt);
      openedByBucket[idx] = (openedByBucket[idx] ?? 0) + 1;
    }
    if (f.resolvedAt && f.resolvedAt >= activityStart) {
      const idx = bucketIndex(f.resolvedAt);
      resolvedByBucket[idx] = (resolvedByBucket[idx] ?? 0) + 1;
    }
  }
  const flagActivity = openedByBucket.map((opened, i) => ({
    week: bucketLabelFmt.format(new Date(activityStart.getTime() + i * activityBucketMs)),
    opened,
    resolved: resolvedByBucket[i] ?? 0,
  }));
  const flagsOpenedThisWeek =
    (openedByBucket[activityPoints - 1] ?? 0) - (resolvedByBucket[activityPoints - 1] ?? 0);

  // ── Dispositions (last 30d) with prior-window comparison for trend ──
  const countDispositions = (
    since: Date,
    until: Date,
  ): { resolved: number; dismissed: number; escalated: number } => {
    let resolved = 0;
    let dismissed = 0;
    let escalated = 0;
    for (const f of flagRows) {
      if (f.cmDisposition === "ESCALATED") {
        // Escalations are counted once against the current window.
        if (until.getTime() === now.getTime()) escalated += 1;
        continue;
      }
      if (!f.resolvedAt) continue;
      if (f.resolvedAt < since || f.resolvedAt >= until) continue;
      if (f.resolutionType === "DISMISSED_WITH_REASON" || f.status === "CLOSED_ACCEPTED_RISK") {
        dismissed += 1;
      } else {
        resolved += 1;
      }
    }
    return { resolved, dismissed, escalated };
  };
  const current = countDispositions(dispCurrentStart, now);
  const prior = countDispositions(dispPriorStart, dispCurrentStart);
  const currentTotal = current.resolved + current.dismissed + current.escalated;
  const currentFpRate =
    currentTotal === 0 ? 0 : Math.round((current.dismissed / currentTotal) * 100);
  const priorTotal = prior.resolved + prior.dismissed;
  const priorFpRate = priorTotal === 0 ? currentFpRate : (prior.dismissed / priorTotal) * 100;
  let dispTrending: "up" | "down" | "flat" = "flat";
  if (currentFpRate > priorFpRate + 1) dispTrending = "up";
  else if (currentFpRate < priorFpRate - 1) dispTrending = "down";
  const dispositions = {
    resolved: current.resolved,
    dismissed: current.dismissed,
    escalated: current.escalated,
    falsePositiveRate: currentFpRate,
    trending: dispTrending,
  };

  // ── Time to finalize strip (one dot per meeting finalized within range) ──
  const finalizePoints = timeToFinalizeRows
    .filter((r) => r.timeToFinalize != null && r.finalizedAt != null && r.finalizedAt >= windowStart)
    .map((r) => ({
      meetingId: r.id,
      clientName: r.clientName,
      rawDays: (r.timeToFinalize ?? 0) / 86400,
    }))
    .sort((a, b) => a.rawDays - b.rawDays);
  const finalizeMax = Math.max(
    15,
    TARGET_DAYS,
    ...finalizePoints.map((p) => p.rawDays),
  );
  const finalizeAvg =
    finalizePoints.length === 0
      ? null
      : Math.round(
          (finalizePoints.reduce((sum, p) => sum + p.rawDays, 0) / finalizePoints.length) * 10,
        ) / 10;
  const finalizeStrip = {
    targetDays: TARGET_DAYS,
    maxDays: Math.ceil(finalizeMax),
    avgDays: finalizeAvg,
    points: finalizePoints.slice(0, 24).map((p) => ({
      meetingId: p.meetingId,
      clientName: p.clientName,
      days: Math.round(p.rawDays * 10) / 10,
      late: p.rawDays > TARGET_DAYS,
    })),
  };

  // ── Audit readiness ──
  const blockedMeetings = clientMeetingRows.filter(
    (m) => m.status === "CM_REVIEWED" || m.status === "CCO_SIGNED_OFF",
  ).length;
  const auditReadiness = {
    ready: finalizedCount,
    total: totalMeetings,
    blocked: blockedMeetings,
    blockedReason: blockedMeetings > 0 ? "awaiting CCO sign-off" : null,
  };

  // ── Health trend: reconstruction from real timestamps across the range ──
  // Not a stored history — recomputed from cumulative finalize + flag-resolution
  // rates as of each bucket boundary, so every point is reproducible from the DB.
  const trendPoints = rangeCfg.trendPoints;
  const trendBucketMs = windowMs / trendPoints;
  const healthTrend = Array.from({ length: trendPoints }, (_, i) => {
    const bucketEnd = new Date(windowStart.getTime() + (i + 1) * trendBucketMs);
    const t = bucketEnd.getTime();
    const totalToDate = clientMeetingRows.filter((m) => m.createdAt.getTime() <= t).length;
    const finalizedToDate = clientMeetingRows.filter(
      (m) => m.finalizedAt != null && m.finalizedAt.getTime() <= t,
    ).length;
    const flagsCreatedToDate = flagRows.filter((f) => f.createdAt.getTime() <= t).length;
    const flagsResolvedToDate = flagRows.filter(
      (f) => f.resolvedAt != null && f.resolvedAt.getTime() <= t,
    ).length;
    const finalizedRate = totalToDate === 0 ? 1 : finalizedToDate / totalToDate;
    const resolvedRate = flagsCreatedToDate === 0 ? 1 : flagsResolvedToDate / flagsCreatedToDate;
    return {
      label: bucketLabelFmt.format(bucketEnd),
      score: Math.round(finalizedRate * 50 + resolvedRate * 50),
    };
  });
  const healthDelta =
    (healthTrend[trendPoints - 1]?.score ?? 0) - (healthTrend[0]?.score ?? 0);
  const trendCaption =
    range === "12m"
      ? "12-month trend"
      : `${Math.round(rangeCfg.days / 7)}-week trend`;

  // ── Clients table ──
  type ClientAccumulator = {
    total: number;
    documented: number;
    finalized: number;
    openFlags: number;
    lastMeeting: Date | null;
    weekly: number[];
  };
  const clientMap = new Map<string, ClientAccumulator>();
  for (const m of clientMeetingRows) {
    const name = m.clientName.trim() || "Unknown client";
    let acc = clientMap.get(name);
    if (!acc) {
      acc = {
        total: 0,
        documented: 0,
        finalized: 0,
        openFlags: 0,
        lastMeeting: null,
        weekly: Array.from({ length: activityPoints }, () => 0),
      };
      clientMap.set(name, acc);
    }
    acc.total += 1;
    if (m.status !== "UPLOADING" && m.status !== "PROCESSING") acc.documented += 1;
    if (m.status === "FINALIZED") acc.finalized += 1;
    acc.openFlags += m.flags.length;
    if (!acc.lastMeeting || m.meetingDate > acc.lastMeeting) acc.lastMeeting = m.meetingDate;
    for (const flag of m.flags) {
      if (flag.createdAt >= activityStart) {
        const idx = bucketIndex(flag.createdAt);
        acc.weekly[idx] = (acc.weekly[idx] ?? 0) + 1;
      }
    }
  }
  const clients: ClientHealthRow[] = Array.from(clientMap.entries())
    .map(([clientName, acc]) => {
      const coverageRate = acc.total === 0 ? 1 : acc.documented / acc.total;
      const finalizedRate = acc.total === 0 ? 1 : acc.finalized / acc.total;
      // Composite client health indicator derived from real signals (coverage,
      // finalize rate, open-flag load). Weighting mirrors the workspace formula.
      const flagPenalty = Math.min(35, acc.openFlags * 5);
      const health = Math.max(
        0,
        Math.min(100, Math.round(coverageRate * 45 + finalizedRate * 35 + 20 - flagPenalty)),
      );
      const mid = Math.floor(acc.weekly.length / 2);
      const firstHalf = acc.weekly.slice(0, mid).reduce((a, b) => a + b, 0);
      const secondHalf = acc.weekly.slice(mid).reduce((a, b) => a + b, 0);
      let trending: "up" | "down" | "flat" = "flat";
      if (secondHalf > firstHalf) trending = "up";
      else if (secondHalf < firstHalf) trending = "down";
      return {
        clientName,
        clientId: null,
        health,
        coverageDone: acc.documented,
        coverageTotal: acc.total,
        openFlags: acc.openFlags,
        lastMeeting: acc.lastMeeting ? acc.lastMeeting.toISOString() : null,
        lastActivity: acc.lastMeeting ? acc.lastMeeting.toISOString() : null,
        lastActivityType: acc.lastMeeting ? ("meeting" as const) : null,
        trend: acc.weekly,
        trending,
      };
    })
    .sort((a, b) => b.openFlags - a.openFlags || a.health - b.health);

  if (isEmailIntelligenceEnabled()) {
    const emailByName = await getEmailLastContactByClientName(workspaceId);
    for (const row of clients) {
      const email = emailByName.get(row.clientName.trim().toLowerCase());
      if (!email) continue;
      row.clientId = email.clientId;
      const meetingAt = row.lastMeeting ? new Date(row.lastMeeting) : null;
      if (!meetingAt || email.lastContactAt > meetingAt) {
        row.lastActivity = email.lastContactAt.toISOString();
        row.lastActivityType = "email";
      } else {
        row.lastActivity = row.lastMeeting;
        row.lastActivityType = "meeting";
      }
      emailByName.delete(row.clientName.trim().toLowerCase());
    }
    // Email-only clients (no meetings in range) still appear when they have contact.
    for (const [, email] of emailByName) {
      clients.push({
        clientName: email.name,
        clientId: email.clientId,
        health: 70,
        coverageDone: 0,
        coverageTotal: 0,
        openFlags: 0,
        lastMeeting: null,
        lastActivity: email.lastContactAt.toISOString(),
        lastActivityType: "email",
        trend: Array.from({ length: activityPoints }, () => 0),
        trending: "flat",
      });
    }
    clients.sort((a, b) => b.openFlags - a.openFlags || a.health - b.health);
  }

  // ── Advisors table: workspace ADVISOR roster + their certification stats ──
  const [advisorMembers, certifiedMeetings] = await Promise.all([
    db.userWorkspace.findMany({
      where: { workspaceId, role: "ADVISOR", removedAt: null },
      select: { userId: true, user: { select: { name: true, email: true, image: true } } },
    }),
    db.meeting.findMany({
      where: { workspaceId, advisorCertifiedByUserId: { not: null } },
      select: {
        advisorCertifiedByUserId: true,
        advisorCertifiedAt: true,
        status: true,
        timeToFinalize: true,
        flags: {
          where: { status: { in: [...OPEN_FLAG_STATUSES] } },
          select: { id: true },
        },
      },
    }),
  ]);

  type AdvisorAccumulator = {
    certifiedCount: number;
    openFlags: number;
    finalizeDaysSum: number;
    finalizeN: number;
    lastActivity: Date | null;
    weekly: number[];
  };
  const advisorMap = new Map<string, AdvisorAccumulator>();
  const ensureAdvisor = (userId: string): AdvisorAccumulator => {
    let acc = advisorMap.get(userId);
    if (!acc) {
      acc = {
        certifiedCount: 0,
        openFlags: 0,
        finalizeDaysSum: 0,
        finalizeN: 0,
        lastActivity: null,
        weekly: Array.from({ length: activityPoints }, () => 0),
      };
      advisorMap.set(userId, acc);
    }
    return acc;
  };
  for (const m of certifiedMeetings) {
    if (!m.advisorCertifiedByUserId) continue;
    const acc = ensureAdvisor(m.advisorCertifiedByUserId);
    acc.certifiedCount += 1;
    acc.openFlags += m.flags.length;
    if (m.status === "FINALIZED" && m.timeToFinalize != null) {
      acc.finalizeDaysSum += m.timeToFinalize / 86400;
      acc.finalizeN += 1;
    }
    if (m.advisorCertifiedAt) {
      if (!acc.lastActivity || m.advisorCertifiedAt > acc.lastActivity) {
        acc.lastActivity = m.advisorCertifiedAt;
      }
      if (m.advisorCertifiedAt >= activityStart) {
        const idx = bucketIndex(m.advisorCertifiedAt);
        acc.weekly[idx] = (acc.weekly[idx] ?? 0) + 1;
      }
    }
  }
  const advisors = advisorMembers
    .map((member) => {
      const acc = advisorMap.get(member.userId);
      const name = member.user?.name?.trim() || member.user?.email || "Advisor";
      // Prefer the advisor's real avatar; otherwise a deterministic placeholder
      // face seeded by their id (stable across renders, unique per advisor).
      const avatarUrl =
        member.user?.image?.trim() ||
        `https://i.pravatar.cc/80?u=${encodeURIComponent(member.userId)}`;
      const weekly = acc?.weekly ?? Array.from({ length: activityPoints }, () => 0);
      const mid = Math.floor(weekly.length / 2);
      const firstHalf = weekly.slice(0, mid).reduce((a, b) => a + b, 0);
      const secondHalf = weekly.slice(mid).reduce((a, b) => a + b, 0);
      let trending: "up" | "down" | "flat" = "flat";
      if (secondHalf > firstHalf) trending = "up";
      else if (secondHalf < firstHalf) trending = "down";
      return {
        userId: member.userId,
        name,
        avatarUrl,
        certifiedCount: acc?.certifiedCount ?? 0,
        openFlags: acc?.openFlags ?? 0,
        avgFinalizeDays:
          acc && acc.finalizeN > 0
            ? Math.round((acc.finalizeDaysSum / acc.finalizeN) * 10) / 10
            : null,
        lastActivity: acc?.lastActivity ? acc.lastActivity.toISOString() : null,
        trend: weekly,
        trending,
      };
    })
    .sort(
      (a, b) => b.openFlags - a.openFlags || b.certifiedCount - a.certifiedCount,
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
    range,
    rangeLabel: rangeCfg.rangeLabel,
    trendCaption,
    healthScore: boundedHealth,
    healthLabel,
    healthTrend,
    healthDelta,
    healthBreakdown: {
      meetingCoverage,
      documentsFinalised,
      flagsResolved,
      signaturesComplete,
    },
    flagActivity,
    flagsOpenedThisWeek,
    flagAging,
    dispositions,
    finalizeStrip,
    auditReadiness,
    clients,
    advisors,
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
