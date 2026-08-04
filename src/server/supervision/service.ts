import { createHash } from "crypto";
import type {
  FlagStatus,
  PrismaClient,
  SupervisoryHoldReason,
  SupervisoryOutcome,
} from "../../../generated/prisma";
import type {
  SupervisionCounts,
  SupervisionSummary,
  SupervisoryInteractionDto,
  SupervisorySamplingConfigDto,
} from "~/lib/types";

type SamplingConfig = {
  randomPercentage: number;
  adviserRiskEnabled: boolean;
  adviserRiskOpenFlagFloor: number;
  newAdviserEnabled: boolean;
  newAdviserWindowDays: number;
  timeSinceLastReviewEnabled: boolean;
  reviewStalenessDays: number;
  manualSelectionEnabled: boolean;
  controlSamplingPolicy: Record<string, number>;
};

type MeetingForOutcome = {
  id: string;
  workspaceId: string;
  status: string;
  transcript: unknown;
  extraction: unknown;
  draftReadyAt: Date | null;
  meetingDate: Date;
  advisorCertifiedByUserId: string | null;
  ccoSignedOffAt: Date | null;
  supervisoryOutcome: SupervisoryOutcome | null;
  outcomeReason: string | null;
  outcomeConfidence: number | null;
  processedAt: Date | null;
  primaryControlId: string | null;
  heldReason: SupervisoryHoldReason | null;
  parkedReason: string | null;
  flags: Array<{
    type: string;
    severity: string;
    status: string;
    cmDisposition: string;
    createdAt: Date;
  }>;
};

type ThreadForOutcome = {
  id: string;
  workspaceId: string;
  channel: string;
  supervisoryOutcome: SupervisoryOutcome | null;
  outcomeReason: string | null;
  outcomeConfidence: number | null;
  processedAt: Date | null;
  primaryControlId: string | null;
  heldReason: SupervisoryHoldReason | null;
  parkedReason: string | null;
  messages: Array<{
    sentAt: Date;
    evidenceItem: {
      classificationStatus: string | null;
    };
    flags: Array<{
      type: string;
      severity: string;
      status: string;
      cmDisposition: string;
      createdAt: Date;
    }>;
  }>;
};

type OutcomeDecision = {
  outcome: SupervisoryOutcome;
  reason: string;
  confidence: number;
  processedAt: Date | null;
  primaryControlId: string | null;
  heldReason: SupervisoryHoldReason | null;
  parkedReason: string | null;
};

export type SupervisionSummaryFilters = {
  dateFrom?: Date;
  dateTo?: Date;
  /** Partner firm filter — must match the caller's workspaceId or results are empty. */
  firmId?: string;
  adviserId?: string;
  channel?: "MEETING" | "EMAIL";
  control?: string;
  outcome?: SupervisoryOutcome;
};

type OutcomeRow = {
  id: string;
  channel: "MEETING" | "EMAIL";
  outcome: SupervisoryOutcome;
};

const OPEN_FLAG_STATUSES = [
  "OPEN",
  "IN_REMEDIATION",
  "PENDING_VERIFICATION",
] as const satisfies readonly FlagStatus[];
const OPEN_FLAG_STATUS_SET = new Set<string>(OPEN_FLAG_STATUSES);
const ESCALATED_DISPOSITIONS = new Set(["ESCALATED"]);
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function hashPercent(key: string): number {
  const digest = createHash("sha256").update(key).digest("hex").slice(0, 8);
  const value = Number.parseInt(digest, 16);
  return value % 100;
}

function hasProcessingError(payload: unknown): boolean {
  if (!payload || typeof payload !== "object") {
    return false;
  }

  const candidate = payload as { error?: unknown };
  return candidate.error === true;
}

function parseControlSamplingPolicy(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const result: Record<string, number> = {};
  for (const [key, rawValue] of Object.entries(value)) {
    if (typeof rawValue !== "number" || !Number.isFinite(rawValue)) {
      continue;
    }

    const bounded = Math.max(0, Math.min(100, Math.round(rawValue)));
    result[key] = bounded;
  }

  return result;
}

function buildSelectivityStatement(priorityFindings: number, totalProcessed: number): string {
  const findingLabel = priorityFindings === 1 ? "finding" : "findings";
  const interactionLabel = totalProcessed === 1 ? "interaction" : "interactions";
  return `${priorityFindings} ${findingLabel} require review from ${totalProcessed} processed ${interactionLabel}.`;
}

function summarizeOutcomes(
  rows: OutcomeRow[],
  openRemediation: number,
  actionableEscalatedIds: Set<string>,
): SupervisionSummary {
  const counts: SupervisionCounts = {
    totalProcessed: rows.length,
    clearedOrDeprioritised: 0,
    routineSamples: 0,
    priorityFindings: 0,
    heldInteractions: 0,
    openRemediation,
  };

  for (const row of rows) {
    if (row.outcome === "CLEARED" || row.outcome === "PARKED") {
      counts.clearedOrDeprioritised += 1;
    } else if (row.outcome === "ROUTINE_SAMPLE") {
      counts.routineSamples += 1;
    } else if (row.outcome === "ESCALATED") {
      if (actionableEscalatedIds.has(row.id)) {
        counts.priorityFindings += 1;
      } else {
        // Closed escalations remain processed but leave the active Priority Inbox count.
        counts.clearedOrDeprioritised += 1;
      }
    } else if (row.outcome === "HELD") {
      counts.heldInteractions += 1;
    }
  }

  return {
    counts,
    selectivityStatement: buildSelectivityStatement(
      counts.priorityFindings,
      counts.totalProcessed,
    ),
  };
}

/** Pure exclusivity check — a single outcome enum cannot be CLEARED and ESCALATED. */
export function outcomesAreMutuallyExclusive(
  a: SupervisoryOutcome,
  b: SupervisoryOutcome,
): boolean {
  if (a === b) return true;
  const exclusive = new Set(["CLEARED", "ESCALATED", "HELD", "PARKED", "ROUTINE_SAMPLE"]);
  return exclusive.has(a) && exclusive.has(b);
}

export function requireParkedReason(reason: string | null | undefined): string {
  const trimmed = reason?.trim() ?? "";
  if (trimmed.length < 3) {
    throw new Error("Parked interactions require a recorded reason");
  }
  return trimmed;
}

export async function getOrCreateSamplingConfig(
  db: PrismaClient,
  workspaceId: string,
): Promise<SupervisorySamplingConfigDto> {
  const config = await getSamplingConfig(db, workspaceId);
  return { workspaceId, ...config };
}

export async function updateSamplingConfig(
  db: PrismaClient,
  args: {
    workspaceId: string;
    userId: string;
    patch: Partial<{
      randomPercentage: number;
      adviserRiskEnabled: boolean;
      adviserRiskOpenFlagFloor: number;
      newAdviserEnabled: boolean;
      newAdviserWindowDays: number;
      timeSinceLastReviewEnabled: boolean;
      reviewStalenessDays: number;
      manualSelectionEnabled: boolean;
      controlSamplingPolicy: Record<string, number>;
    }>;
  },
): Promise<SupervisorySamplingConfigDto> {
  await getSamplingConfig(db, args.workspaceId);

  const updated = await db.$transaction(async (tx) => {
    const row = await tx.supervisorySamplingConfig.update({
      where: { workspaceId: args.workspaceId },
      data: {
        ...(args.patch.randomPercentage !== undefined
          ? { randomPercentage: Math.max(0, Math.min(100, args.patch.randomPercentage)) }
          : {}),
        ...(args.patch.adviserRiskEnabled !== undefined
          ? { adviserRiskEnabled: args.patch.adviserRiskEnabled }
          : {}),
        ...(args.patch.adviserRiskOpenFlagFloor !== undefined
          ? { adviserRiskOpenFlagFloor: Math.max(1, args.patch.adviserRiskOpenFlagFloor) }
          : {}),
        ...(args.patch.newAdviserEnabled !== undefined
          ? { newAdviserEnabled: args.patch.newAdviserEnabled }
          : {}),
        ...(args.patch.newAdviserWindowDays !== undefined
          ? { newAdviserWindowDays: Math.max(1, args.patch.newAdviserWindowDays) }
          : {}),
        ...(args.patch.timeSinceLastReviewEnabled !== undefined
          ? { timeSinceLastReviewEnabled: args.patch.timeSinceLastReviewEnabled }
          : {}),
        ...(args.patch.reviewStalenessDays !== undefined
          ? { reviewStalenessDays: Math.max(1, args.patch.reviewStalenessDays) }
          : {}),
        ...(args.patch.manualSelectionEnabled !== undefined
          ? { manualSelectionEnabled: args.patch.manualSelectionEnabled }
          : {}),
        ...(args.patch.controlSamplingPolicy !== undefined
          ? { controlSamplingPolicy: args.patch.controlSamplingPolicy }
          : {}),
      },
    });

    await tx.auditEvent.create({
      data: {
        workspaceId: args.workspaceId,
        userId: args.userId,
        action: "SUPERVISORY_OUTCOME_ASSIGNED",
        resourceType: "supervisory_sampling_config",
        resourceId: row.id,
        metadata: {
          action: "sampling_config_updated",
          patchKeys: Object.keys(args.patch),
        },
      },
    });

    return row;
  });

  return {
    workspaceId: args.workspaceId,
    randomPercentage: updated.randomPercentage,
    adviserRiskEnabled: updated.adviserRiskEnabled,
    adviserRiskOpenFlagFloor: updated.adviserRiskOpenFlagFloor,
    newAdviserEnabled: updated.newAdviserEnabled,
    newAdviserWindowDays: updated.newAdviserWindowDays,
    timeSinceLastReviewEnabled: updated.timeSinceLastReviewEnabled,
    reviewStalenessDays: updated.reviewStalenessDays,
    manualSelectionEnabled: updated.manualSelectionEnabled,
    controlSamplingPolicy: parseControlSamplingPolicy(updated.controlSamplingPolicy),
  };
}

function primaryControlFromFlags(
  flags: Array<{ type: string; severity: string; createdAt: Date }>,
): string | null {
  if (flags.length === 0) {
    return null;
  }

  const severityRank = (severity: string): number => {
    if (severity === "CRITICAL") return 0;
    if (severity === "WARN") return 1;
    return 2;
  };

  const sorted = [...flags].sort((a, b) => {
    const bySeverity = severityRank(a.severity) - severityRank(b.severity);
    if (bySeverity !== 0) return bySeverity;
    return a.createdAt.getTime() - b.createdAt.getTime();
  });

  return sorted[0]?.type ?? null;
}

async function hasActivePolicyMapping(
  db: PrismaClient,
  workspaceId: string,
): Promise<boolean> {
  const profile = await db.firmProfile.findFirst({
    where: { workspaceId, deletedAt: null, status: "ACTIVE" },
    select: { id: true },
  });

  return Boolean(profile);
}

async function getSamplingConfig(
  db: PrismaClient,
  workspaceId: string,
): Promise<SamplingConfig> {
  const existing = await db.supervisorySamplingConfig.findUnique({
    where: { workspaceId },
  });

  if (!existing) {
    const created = await db.supervisorySamplingConfig.create({
      data: { workspaceId },
    });

    return {
      randomPercentage: created.randomPercentage,
      adviserRiskEnabled: created.adviserRiskEnabled,
      adviserRiskOpenFlagFloor: created.adviserRiskOpenFlagFloor,
      newAdviserEnabled: created.newAdviserEnabled,
      newAdviserWindowDays: created.newAdviserWindowDays,
      timeSinceLastReviewEnabled: created.timeSinceLastReviewEnabled,
      reviewStalenessDays: created.reviewStalenessDays,
      manualSelectionEnabled: created.manualSelectionEnabled,
      controlSamplingPolicy: parseControlSamplingPolicy(created.controlSamplingPolicy),
    };
  }

  return {
    randomPercentage: existing.randomPercentage,
    adviserRiskEnabled: existing.adviserRiskEnabled,
    adviserRiskOpenFlagFloor: existing.adviserRiskOpenFlagFloor,
    newAdviserEnabled: existing.newAdviserEnabled,
    newAdviserWindowDays: existing.newAdviserWindowDays,
    timeSinceLastReviewEnabled: existing.timeSinceLastReviewEnabled,
    reviewStalenessDays: existing.reviewStalenessDays,
    manualSelectionEnabled: existing.manualSelectionEnabled,
    controlSamplingPolicy: parseControlSamplingPolicy(existing.controlSamplingPolicy),
  };
}

async function meetingSampleReason(
  db: PrismaClient,
  meeting: MeetingForOutcome,
  primaryControlId: string | null,
  config: SamplingConfig,
  now: Date,
): Promise<string | null> {
  if (primaryControlId) {
    const controlRate = config.controlSamplingPolicy[primaryControlId];
    if (typeof controlRate === "number" && controlRate > 0) {
      if (hashPercent(`meeting-control:${meeting.id}:${primaryControlId}`) < controlRate) {
        return `Control-specific policy sample (${primaryControlId})`;
      }
    }
  }

  if (config.adviserRiskEnabled && meeting.advisorCertifiedByUserId) {
    const openHistoricalFlags = await db.flag.count({
      where: {
        workspaceId: meeting.workspaceId,
        meeting: {
          advisorCertifiedByUserId: meeting.advisorCertifiedByUserId,
        },
        status: { in: [...OPEN_FLAG_STATUSES] },
      },
    });

    if (openHistoricalFlags >= config.adviserRiskOpenFlagFloor) {
      return "Adviser risk sample";
    }
  }

  if (config.newAdviserEnabled && meeting.advisorCertifiedByUserId) {
    const firstAdviserMeeting = await db.meeting.findFirst({
      where: {
        workspaceId: meeting.workspaceId,
        advisorCertifiedByUserId: meeting.advisorCertifiedByUserId,
      },
      orderBy: { meetingDate: "asc" },
      select: { meetingDate: true },
    });

    if (firstAdviserMeeting) {
      const ageDays = Math.floor(
        (now.getTime() - firstAdviserMeeting.meetingDate.getTime()) / ONE_DAY_MS,
      );
      if (ageDays <= config.newAdviserWindowDays) {
        return "New adviser sample";
      }
    }
  }

  if (config.timeSinceLastReviewEnabled && meeting.advisorCertifiedByUserId) {
    const lastReviewed = await db.meeting.findFirst({
      where: {
        workspaceId: meeting.workspaceId,
        advisorCertifiedByUserId: meeting.advisorCertifiedByUserId,
        ccoSignedOffAt: { not: null },
        id: { not: meeting.id },
      },
      orderBy: { ccoSignedOffAt: "desc" },
      select: { ccoSignedOffAt: true },
    });

    if (!lastReviewed?.ccoSignedOffAt) {
      return "No recent review sample";
    }

    const daysSinceReview = Math.floor(
      (now.getTime() - lastReviewed.ccoSignedOffAt.getTime()) / ONE_DAY_MS,
    );
    if (daysSinceReview >= config.reviewStalenessDays) {
      return "Review staleness sample";
    }
  }

  if (config.randomPercentage > 0) {
    const bucket = hashPercent(`meeting-random:${meeting.id}`);
    if (bucket < config.randomPercentage) {
      return `Random ${config.randomPercentage}% sample`;
    }
  }

  return null;
}

function threadSampleReason(
  thread: ThreadForOutcome,
  primaryControlId: string | null,
  config: SamplingConfig,
): string | null {
  if (primaryControlId) {
    const controlRate = config.controlSamplingPolicy[primaryControlId];
    if (typeof controlRate === "number" && controlRate > 0) {
      if (hashPercent(`thread-control:${thread.id}:${primaryControlId}`) < controlRate) {
        return `Control-specific policy sample (${primaryControlId})`;
      }
    }
  }

  if (config.randomPercentage > 0) {
    const bucket = hashPercent(`thread-random:${thread.id}`);
    if (bucket < config.randomPercentage) {
      return `Random ${config.randomPercentage}% sample`;
    }
  }

  return null;
}

async function decideMeetingOutcome(
  db: PrismaClient,
  meeting: MeetingForOutcome,
  now: Date,
): Promise<OutcomeDecision | null> {
  const hasFailure = hasProcessingError(meeting.transcript) || hasProcessingError(meeting.extraction);
  if (hasFailure) {
    return {
      outcome: "HELD",
      reason: "Processing failed",
      confidence: 1,
      processedAt: now,
      primaryControlId: null,
      heldReason: "PROCESSING_FAILED",
      parkedReason: null,
    };
  }

  if (meeting.status === "UPLOADING" || meeting.status === "PROCESSING") {
    return null;
  }

  const activePolicy = await hasActivePolicyMapping(db, meeting.workspaceId);
  if (!activePolicy) {
    return {
      outcome: "HELD",
      reason: "No active policy mapping",
      confidence: 1,
      processedAt: now,
      primaryControlId: null,
      heldReason: "ACTIVE_POLICY_UNAVAILABLE",
      parkedReason: null,
    };
  }

  const actionableFlags = meeting.flags.filter(
    (flag) =>
      OPEN_FLAG_STATUS_SET.has(flag.status) ||
      ESCALATED_DISPOSITIONS.has(flag.cmDisposition),
  );
  const primaryControlId = primaryControlFromFlags(actionableFlags);

  if (actionableFlags.length > 0) {
    return {
      outcome: "ESCALATED",
      reason: "Actionable supervisory finding",
      confidence: 0.95,
      processedAt: now,
      primaryControlId,
      heldReason: null,
      parkedReason: null,
    };
  }

  const config = await getSamplingConfig(db, meeting.workspaceId);
  const sampleReason = await meetingSampleReason(db, meeting, primaryControlId, config, now);
  if (sampleReason) {
    return {
      outcome: "ROUTINE_SAMPLE",
      reason: sampleReason,
      confidence: 0.7,
      processedAt: now,
      primaryControlId,
      heldReason: null,
      parkedReason: null,
    };
  }

  return {
    outcome: "CLEARED",
    reason: "No actionable supervisory concern identified",
    confidence: 0.85,
    processedAt: now,
    primaryControlId: null,
    heldReason: null,
    parkedReason: null,
  };
}

async function decideThreadOutcome(
  db: PrismaClient,
  thread: ThreadForOutcome,
  now: Date,
): Promise<OutcomeDecision | null> {
  const messageCount = thread.messages.length;
  if (messageCount === 0) {
    return null;
  }

  const statuses = thread.messages.map((message) => message.evidenceItem.classificationStatus);
  const hasFailure = statuses.includes("FAILED");
  if (hasFailure) {
    return {
      outcome: "HELD",
      reason: "Processing failed",
      confidence: 1,
      processedAt: now,
      primaryControlId: null,
      heldReason: "PROCESSING_FAILED",
      parkedReason: null,
    };
  }

  const allClassified = statuses.every((status) => status === "COMPLETE");
  if (!allClassified) {
    return null;
  }

  const activePolicy = await hasActivePolicyMapping(db, thread.workspaceId);
  if (!activePolicy) {
    return {
      outcome: "HELD",
      reason: "No active policy mapping",
      confidence: 1,
      processedAt: now,
      primaryControlId: null,
      heldReason: "ACTIVE_POLICY_UNAVAILABLE",
      parkedReason: null,
    };
  }

  const actionableFlags = thread.messages
    .flatMap((message) => message.flags)
    .filter(
      (flag) =>
        OPEN_FLAG_STATUS_SET.has(flag.status) ||
        ESCALATED_DISPOSITIONS.has(flag.cmDisposition),
    );
  const primaryControlId = primaryControlFromFlags(actionableFlags);

  if (actionableFlags.length > 0) {
    return {
      outcome: "ESCALATED",
      reason: "Actionable supervisory finding",
      confidence: 0.95,
      processedAt: now,
      primaryControlId,
      heldReason: null,
      parkedReason: null,
    };
  }

  const config = await getSamplingConfig(db, thread.workspaceId);
  const sampleReason = threadSampleReason(thread, primaryControlId, config);
  if (sampleReason) {
    return {
      outcome: "ROUTINE_SAMPLE",
      reason: sampleReason,
      confidence: 0.7,
      processedAt: now,
      primaryControlId,
      heldReason: null,
      parkedReason: null,
    };
  }

  return {
    outcome: "CLEARED",
    reason: "No actionable supervisory concern identified",
    confidence: 0.85,
    processedAt: now,
    primaryControlId: null,
    heldReason: null,
    parkedReason: null,
  };
}

export async function syncMeetingSupervisoryOutcome(
  db: PrismaClient,
  meetingId: string,
): Promise<SupervisoryOutcome | null> {
  const meetingDelegate = (db as Partial<PrismaClient>).meeting;
  const auditDelegate = (db as Partial<PrismaClient>).auditEvent;
  if (!meetingDelegate || !auditDelegate) {
    return null;
  }

  const meeting = await meetingDelegate.findFirst({
    where: { id: meetingId },
    select: {
      id: true,
      workspaceId: true,
      status: true,
      transcript: true,
      extraction: true,
      draftReadyAt: true,
      meetingDate: true,
      advisorCertifiedByUserId: true,
      ccoSignedOffAt: true,
      supervisoryOutcome: true,
      outcomeReason: true,
      outcomeConfidence: true,
      processedAt: true,
      primaryControlId: true,
      heldReason: true,
      parkedReason: true,
      flags: {
        where: { workspaceId: { not: "" } },
        select: {
          type: true,
          severity: true,
          status: true,
          cmDisposition: true,
          createdAt: true,
        },
      },
    },
  });

  if (!meeting) {
    return null;
  }

  const decision = await decideMeetingOutcome(db, meeting, new Date());
  if (!decision) {
    return null;
  }

  const changed =
    meeting.supervisoryOutcome !== decision.outcome ||
    meeting.outcomeReason !== decision.reason ||
    meeting.outcomeConfidence !== decision.confidence ||
    meeting.primaryControlId !== decision.primaryControlId ||
    meeting.heldReason !== decision.heldReason ||
    meeting.parkedReason !== decision.parkedReason ||
    !meeting.processedAt;

  if (!changed) {
    return decision.outcome;
  }

  if (!(db as Partial<PrismaClient>).$transaction) {
    return decision.outcome;
  }

  await db.$transaction(async (tx) => {
    await tx.meeting.update({
      where: { id: meeting.id },
      data: {
        supervisoryOutcome: decision.outcome,
        outcomeReason: decision.reason,
        outcomeConfidence: decision.confidence,
        processedAt: decision.processedAt,
        primaryControlId: decision.primaryControlId,
        heldReason: decision.heldReason,
        parkedReason: decision.parkedReason,
      },
    });

    await tx.auditEvent.create({
      data: {
        workspaceId: meeting.workspaceId,
        userId: "system",
        action:
          decision.outcome === "ROUTINE_SAMPLE"
            ? "SUPERVISORY_SAMPLE_SELECTED"
            : "SUPERVISORY_OUTCOME_ASSIGNED",
        resourceType: "meeting",
        resourceId: meeting.id,
        meetingId: meeting.id,
        metadata: {
          previousOutcome: meeting.supervisoryOutcome,
          newOutcome: decision.outcome,
          reason: decision.reason,
          primaryControlId: decision.primaryControlId,
          heldReason: decision.heldReason,
        },
      },
    });
  });

  return decision.outcome;
}

export async function syncThreadSupervisoryOutcome(
  db: PrismaClient,
  threadId: string,
): Promise<SupervisoryOutcome | null> {
  const threadDelegate = (db as Partial<PrismaClient>).communicationThread;
  const auditDelegate = (db as Partial<PrismaClient>).auditEvent;
  if (!threadDelegate || !auditDelegate) {
    return null;
  }

  const thread = await threadDelegate.findFirst({
    where: { id: threadId, deletedAt: null },
    select: {
      id: true,
      workspaceId: true,
      channel: true,
      supervisoryOutcome: true,
      outcomeReason: true,
      outcomeConfidence: true,
      processedAt: true,
      primaryControlId: true,
      heldReason: true,
      parkedReason: true,
      messages: {
        where: { deletedAt: null },
        select: {
          sentAt: true,
          evidenceItem: {
            select: {
              classificationStatus: true,
            },
          },
          flags: {
            select: {
              type: true,
              severity: true,
              status: true,
              cmDisposition: true,
              createdAt: true,
            },
          },
        },
      },
    },
  });

  if (!thread) {
    return null;
  }

  const decision = await decideThreadOutcome(db, thread, new Date());
  if (!decision) {
    return null;
  }

  const changed =
    thread.supervisoryOutcome !== decision.outcome ||
    thread.outcomeReason !== decision.reason ||
    thread.outcomeConfidence !== decision.confidence ||
    thread.primaryControlId !== decision.primaryControlId ||
    thread.heldReason !== decision.heldReason ||
    thread.parkedReason !== decision.parkedReason ||
    !thread.processedAt;

  if (!changed) {
    return decision.outcome;
  }

  if (!(db as Partial<PrismaClient>).$transaction) {
    return decision.outcome;
  }

  await db.$transaction(async (tx) => {
    await tx.communicationThread.update({
      where: { id: thread.id },
      data: {
        supervisoryOutcome: decision.outcome,
        outcomeReason: decision.reason,
        outcomeConfidence: decision.confidence,
        processedAt: decision.processedAt,
        primaryControlId: decision.primaryControlId,
        heldReason: decision.heldReason,
        parkedReason: decision.parkedReason,
      },
    });

    await tx.auditEvent.create({
      data: {
        workspaceId: thread.workspaceId,
        userId: "system",
        action:
          decision.outcome === "ROUTINE_SAMPLE"
            ? "SUPERVISORY_SAMPLE_SELECTED"
            : "SUPERVISORY_OUTCOME_ASSIGNED",
        resourceType: "communication_thread",
        resourceId: thread.id,
        metadata: {
          previousOutcome: thread.supervisoryOutcome,
          newOutcome: decision.outcome,
          reason: decision.reason,
          primaryControlId: decision.primaryControlId,
          heldReason: decision.heldReason,
          channel: thread.channel,
        },
      },
    });
  });

  return decision.outcome;
}

export async function getSupervisionSummary(
  db: PrismaClient,
  workspaceId: string,
  filters: SupervisionSummaryFilters = {},
): Promise<SupervisionSummary> {
  if (filters.firmId && filters.firmId !== workspaceId) {
    return summarizeOutcomes([], 0, new Set());
  }

  const dateFilter =
    filters.dateFrom || filters.dateTo
      ? {
          gte: filters.dateFrom,
          lte: filters.dateTo,
        }
      : undefined;

  const meetingWhere = {
    workspaceId,
    processedAt: { not: null },
    ...(dateFilter ? { meetingDate: dateFilter } : {}),
    ...(filters.adviserId ? { advisorCertifiedByUserId: filters.adviserId } : {}),
    ...(filters.control ? { primaryControlId: filters.control } : {}),
    ...(filters.outcome ? { supervisoryOutcome: filters.outcome } : {}),
  };

  const threadWhere = {
    workspaceId,
    deletedAt: null,
    processedAt: { not: null },
    ...(dateFilter ? { updatedAt: dateFilter } : {}),
    ...(filters.control ? { primaryControlId: filters.control } : {}),
    ...(filters.outcome ? { supervisoryOutcome: filters.outcome } : {}),
  };

  const [meetings, threads, openRemediation] = await Promise.all([
    filters.channel === "EMAIL"
      ? Promise.resolve<
          Array<{
            id: string;
            supervisoryOutcome: SupervisoryOutcome | null;
            flags: Array<{ id: string }>;
          }>
        >([])
      : db.meeting.findMany({
          where: meetingWhere,
          select: {
            id: true,
            supervisoryOutcome: true,
            flags: {
              where: { status: { in: [...OPEN_FLAG_STATUSES] } },
              select: { id: true },
              take: 1,
            },
          },
        }),
    filters.channel === "MEETING"
      ? Promise.resolve<
          Array<{
            id: string;
            supervisoryOutcome: SupervisoryOutcome | null;
            messages: Array<{ flags: Array<{ id: string }> }>;
          }>
        >([])
      : db.communicationThread.findMany({
          where: threadWhere,
          select: {
            id: true,
            supervisoryOutcome: true,
            messages: {
              where: { deletedAt: null },
              select: {
                flags: {
                  where: { status: { in: [...OPEN_FLAG_STATUSES] } },
                  select: { id: true },
                  take: 1,
                },
              },
            },
          },
        }),
    db.actionItem.count({
      where: {
        status: { in: ["OPEN", "IN_PROGRESS"] },
        resolution: {
          workspaceId,
          flag: {
            workspaceId,
          },
        },
      },
    }),
  ]);

  const rows: OutcomeRow[] = [];
  const actionableEscalatedIds = new Set<string>();

  for (const row of meetings) {
    if (!row.supervisoryOutcome) continue;
    rows.push({ id: row.id, channel: "MEETING", outcome: row.supervisoryOutcome });
    if (row.supervisoryOutcome === "ESCALATED" && row.flags.length > 0) {
      actionableEscalatedIds.add(row.id);
    }
  }

  for (const row of threads) {
    if (!row.supervisoryOutcome) continue;
    rows.push({ id: row.id, channel: "EMAIL", outcome: row.supervisoryOutcome });
    const hasOpenFlag = row.messages.some((message) => message.flags.length > 0);
    if (row.supervisoryOutcome === "ESCALATED" && hasOpenFlag) {
      actionableEscalatedIds.add(row.id);
    }
  }

  return summarizeOutcomes(rows, openRemediation, actionableEscalatedIds);
}

export async function listSupervisoryInteractions(
  db: PrismaClient,
  workspaceId: string,
  filters: SupervisionSummaryFilters = {},
): Promise<SupervisoryInteractionDto[]> {
  if (filters.firmId && filters.firmId !== workspaceId) {
    return [];
  }

  const dateFilter =
    filters.dateFrom || filters.dateTo
      ? {
          gte: filters.dateFrom,
          lte: filters.dateTo,
        }
      : undefined;

  const [meetings, threads] = await Promise.all([
    filters.channel === "EMAIL"
      ? Promise.resolve([])
      : db.meeting.findMany({
          where: {
            workspaceId,
            processedAt: { not: null },
            supervisoryOutcome: filters.outcome ?? { not: null },
            ...(dateFilter ? { meetingDate: dateFilter } : {}),
            ...(filters.adviserId ? { advisorCertifiedByUserId: filters.adviserId } : {}),
            ...(filters.control ? { primaryControlId: filters.control } : {}),
          },
          select: {
            id: true,
            clientName: true,
            meetingDate: true,
            processedAt: true,
            supervisoryOutcome: true,
            outcomeReason: true,
            outcomeConfidence: true,
            primaryControlId: true,
            heldReason: true,
            parkedReason: true,
          },
          orderBy: { meetingDate: "desc" },
          take: 200,
        }),
    filters.channel === "MEETING"
      ? Promise.resolve([])
      : db.communicationThread.findMany({
          where: {
            workspaceId,
            deletedAt: null,
            processedAt: { not: null },
            supervisoryOutcome: filters.outcome ?? { not: null },
            ...(dateFilter ? { updatedAt: dateFilter } : {}),
            ...(filters.control ? { primaryControlId: filters.control } : {}),
          },
          select: {
            id: true,
            subject: true,
            processedAt: true,
            updatedAt: true,
            supervisoryOutcome: true,
            outcomeReason: true,
            outcomeConfidence: true,
            primaryControlId: true,
            heldReason: true,
            parkedReason: true,
          },
          orderBy: { updatedAt: "desc" },
          take: 200,
        }),
  ]);

  const meetingDtos: SupervisoryInteractionDto[] = meetings.flatMap((m) => {
    if (!m.supervisoryOutcome) return [];
    return [
      {
        id: m.id,
        channel: "MEETING" as const,
        title: m.clientName,
        occurredAt: m.meetingDate.toISOString(),
        processedAt: m.processedAt?.toISOString() ?? null,
        supervisoryOutcome: m.supervisoryOutcome,
        outcomeReason: m.outcomeReason,
        outcomeConfidence: m.outcomeConfidence,
        primaryControlId: m.primaryControlId,
        heldReason: m.heldReason,
        parkedReason: m.parkedReason,
        href: `/meetings/${m.id}`,
      },
    ];
  });

  const threadDtos: SupervisoryInteractionDto[] = threads.flatMap((t) => {
    if (!t.supervisoryOutcome) return [];
    return [
      {
        id: t.id,
        channel: "EMAIL" as const,
        title: t.subject?.trim() || "Email thread",
        occurredAt: t.updatedAt.toISOString(),
        processedAt: t.processedAt?.toISOString() ?? null,
        supervisoryOutcome: t.supervisoryOutcome,
        outcomeReason: t.outcomeReason,
        outcomeConfidence: t.outcomeConfidence,
        primaryControlId: t.primaryControlId,
        heldReason: t.heldReason,
        parkedReason: t.parkedReason,
        href: `/communications/threads/${t.id}`,
      },
    ];
  });

  return [...meetingDtos, ...threadDtos].sort((a, b) => {
    const aTime = a.occurredAt ? Date.parse(a.occurredAt) : 0;
    const bTime = b.occurredAt ? Date.parse(b.occurredAt) : 0;
    return bTime - aTime;
  });
}

export async function parkInteraction(args: {
  db: PrismaClient;
  workspaceId: string;
  userId: string;
  channel: "MEETING" | "EMAIL";
  interactionId: string;
  reason: string;
}): Promise<{ success: true } | { success: false; error: string }> {
  let parkedReason: string;
  try {
    parkedReason = requireParkedReason(args.reason);
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Parked reason required",
    };
  }

  if (args.channel === "MEETING") {
    const meeting = await args.db.meeting.findFirst({
      where: { id: args.interactionId, workspaceId: args.workspaceId },
      select: { id: true, supervisoryOutcome: true },
    });
    if (!meeting) return { success: false, error: "Interaction not found" };

    await args.db.$transaction(async (tx) => {
      await tx.meeting.update({
        where: { id: meeting.id },
        data: {
          supervisoryOutcome: "PARKED",
          outcomeReason: parkedReason,
          outcomeConfidence: 1,
          processedAt: new Date(),
          primaryControlId: null,
          heldReason: null,
          parkedReason,
        },
      });
      await tx.auditEvent.create({
        data: {
          workspaceId: args.workspaceId,
          userId: args.userId,
          action: "SUPERVISORY_OUTCOME_ASSIGNED",
          resourceType: "meeting",
          resourceId: meeting.id,
          meetingId: meeting.id,
          metadata: {
            previousOutcome: meeting.supervisoryOutcome,
            newOutcome: "PARKED",
            reason: parkedReason,
          },
        },
      });
    });
    return { success: true };
  }

  const thread = await args.db.communicationThread.findFirst({
    where: { id: args.interactionId, workspaceId: args.workspaceId, deletedAt: null },
    select: { id: true, supervisoryOutcome: true },
  });
  if (!thread) return { success: false, error: "Interaction not found" };

  await args.db.$transaction(async (tx) => {
    await tx.communicationThread.update({
      where: { id: thread.id },
      data: {
        supervisoryOutcome: "PARKED",
        outcomeReason: parkedReason,
        outcomeConfidence: 1,
        processedAt: new Date(),
        primaryControlId: null,
        heldReason: null,
        parkedReason,
      },
    });
    await tx.auditEvent.create({
      data: {
        workspaceId: args.workspaceId,
        userId: args.userId,
        action: "SUPERVISORY_OUTCOME_ASSIGNED",
        resourceType: "communication_thread",
        resourceId: thread.id,
        metadata: {
          previousOutcome: thread.supervisoryOutcome,
          newOutcome: "PARKED",
          reason: parkedReason,
        },
      },
    });
  });
  return { success: true };
}

export async function manuallySelectForSampling(args: {
  db: PrismaClient;
  workspaceId: string;
  userId: string;
  channel: "MEETING" | "EMAIL";
  interactionId: string;
  reason?: string;
}): Promise<{ success: true; data: { outcome: SupervisoryOutcome } } | { success: false; error: string }> {
  const config = await getSamplingConfig(args.db, args.workspaceId);
  if (!config.manualSelectionEnabled) {
    return { success: false, error: "Manual sampling is disabled for this workspace" };
  }

  const sampleReason = (args.reason?.trim() || "Manual selection").slice(0, 500);

  if (args.channel === "MEETING") {
    const meeting = await args.db.meeting.findFirst({
      where: { id: args.interactionId, workspaceId: args.workspaceId },
      select: { id: true, supervisoryOutcome: true },
    });
    if (!meeting) return { success: false, error: "Interaction not found" };
    if (meeting.supervisoryOutcome === "ESCALATED") {
      return { success: false, error: "Escalated interactions cannot be sampled" };
    }

    await args.db.$transaction(async (tx) => {
      await tx.meeting.update({
        where: { id: meeting.id },
        data: {
          supervisoryOutcome: "ROUTINE_SAMPLE",
          outcomeReason: sampleReason,
          outcomeConfidence: 1,
          processedAt: new Date(),
          heldReason: null,
          parkedReason: null,
        },
      });
      await tx.auditEvent.create({
        data: {
          workspaceId: args.workspaceId,
          userId: args.userId,
          action: "SUPERVISORY_SAMPLE_SELECTED",
          resourceType: "meeting",
          resourceId: meeting.id,
          meetingId: meeting.id,
          metadata: {
            previousOutcome: meeting.supervisoryOutcome,
            newOutcome: "ROUTINE_SAMPLE",
            reason: sampleReason,
            manual: true,
          },
        },
      });
    });

    return { success: true, data: { outcome: "ROUTINE_SAMPLE" } };
  }

  const thread = await args.db.communicationThread.findFirst({
    where: { id: args.interactionId, workspaceId: args.workspaceId, deletedAt: null },
    select: { id: true, supervisoryOutcome: true },
  });
  if (!thread) return { success: false, error: "Interaction not found" };
  if (thread.supervisoryOutcome === "ESCALATED") {
    return { success: false, error: "Escalated interactions cannot be sampled" };
  }

  await args.db.$transaction(async (tx) => {
    await tx.communicationThread.update({
      where: { id: thread.id },
      data: {
        supervisoryOutcome: "ROUTINE_SAMPLE",
        outcomeReason: sampleReason,
        outcomeConfidence: 1,
        processedAt: new Date(),
        heldReason: null,
        parkedReason: null,
      },
    });
    await tx.auditEvent.create({
      data: {
        workspaceId: args.workspaceId,
        userId: args.userId,
        action: "SUPERVISORY_SAMPLE_SELECTED",
        resourceType: "communication_thread",
        resourceId: thread.id,
        metadata: {
          previousOutcome: thread.supervisoryOutcome,
          newOutcome: "ROUTINE_SAMPLE",
          reason: sampleReason,
          manual: true,
        },
      },
    });
  });

  return { success: true, data: { outcome: "ROUTINE_SAMPLE" } };
}

/**
 * Manual escalation of a routine sample creates a Flag (finding) and audit event.
 * Sampling itself never creates a priority finding.
 */
export async function manuallyEscalateSampledInteraction(args: {
  db: PrismaClient;
  workspaceId: string;
  userId: string;
  channel: "MEETING" | "EMAIL";
  interactionId: string;
  escalationReason: string;
  controlType?: string;
}): Promise<
  | { success: true; data: { flagId: string; outcome: SupervisoryOutcome } }
  | { success: false; error: string }
> {
  const reason = args.escalationReason.trim();
  if (reason.length < 10) {
    return { success: false, error: "Escalation reason is required" };
  }

  const controlType = args.controlType ?? "MISSING_DISCLOSURE";

  if (args.channel === "MEETING") {
    const meeting = await args.db.meeting.findFirst({
      where: { id: args.interactionId, workspaceId: args.workspaceId },
      select: { id: true, supervisoryOutcome: true },
    });
    if (!meeting) return { success: false, error: "Interaction not found" };
    if (meeting.supervisoryOutcome !== "ROUTINE_SAMPLE" && meeting.supervisoryOutcome !== "CLEARED") {
      return {
        success: false,
        error: "Only cleared or sampled interactions can be manually escalated from this path",
      };
    }

    const result = await args.db.$transaction(async (tx) => {
      const flag = await tx.flag.create({
        data: {
          workspaceId: args.workspaceId,
          meetingId: meeting.id,
          sourceType: "MEETING",
          sourceId: meeting.id,
          type: controlType as never,
          severity: "WARN",
          status: "OPEN",
          createdByType: "USER",
          createdByUserId: args.userId,
          cmDisposition: "ESCALATED",
          escalationReason: reason,
          cmTriagedAt: new Date(),
          cmTriagedByUserId: args.userId,
          evidence: {
            rationale: reason,
            manualEscalation: true,
            fromSample: meeting.supervisoryOutcome === "ROUTINE_SAMPLE",
          },
        },
      });

      await tx.meeting.update({
        where: { id: meeting.id },
        data: {
          supervisoryOutcome: "ESCALATED",
          outcomeReason: reason,
          outcomeConfidence: 1,
          processedAt: new Date(),
          primaryControlId: controlType,
          heldReason: null,
          parkedReason: null,
        },
      });

      await tx.auditEvent.create({
        data: {
          workspaceId: args.workspaceId,
          userId: args.userId,
          action: "SUPERVISORY_OUTCOME_ASSIGNED",
          resourceType: "meeting",
          resourceId: meeting.id,
          meetingId: meeting.id,
          metadata: {
            previousOutcome: meeting.supervisoryOutcome,
            newOutcome: "ESCALATED",
            reason,
            flagId: flag.id,
            manualEscalation: true,
          },
        },
      });

      return flag.id;
    });

    return { success: true, data: { flagId: result, outcome: "ESCALATED" } };
  }

  const thread = await args.db.communicationThread.findFirst({
    where: { id: args.interactionId, workspaceId: args.workspaceId, deletedAt: null },
    include: {
      messages: {
        where: { deletedAt: null },
        orderBy: { sentAt: "desc" },
        take: 1,
        select: { id: true },
      },
    },
  });
  if (!thread) return { success: false, error: "Interaction not found" };
  if (thread.supervisoryOutcome !== "ROUTINE_SAMPLE" && thread.supervisoryOutcome !== "CLEARED") {
    return {
      success: false,
      error: "Only cleared or sampled interactions can be manually escalated from this path",
    };
  }

  const communicationId = thread.messages[0]?.id ?? null;
  const result = await args.db.$transaction(async (tx) => {
    const flag = await tx.flag.create({
      data: {
        workspaceId: args.workspaceId,
        meetingId: null,
        sourceType: "EMAIL",
        sourceId: thread.id,
        communicationId,
        type: controlType as never,
        severity: "WARN",
        status: "OPEN",
        createdByType: "USER",
        createdByUserId: args.userId,
        cmDisposition: "ESCALATED",
        escalationReason: reason,
        cmTriagedAt: new Date(),
        cmTriagedByUserId: args.userId,
        evidence: {
          rationale: reason,
          manualEscalation: true,
          fromSample: thread.supervisoryOutcome === "ROUTINE_SAMPLE",
          threadId: thread.id,
        },
      },
    });

    await tx.communicationThread.update({
      where: { id: thread.id },
      data: {
        supervisoryOutcome: "ESCALATED",
        outcomeReason: reason,
        outcomeConfidence: 1,
        processedAt: new Date(),
        primaryControlId: controlType,
        heldReason: null,
        parkedReason: null,
      },
    });

    await tx.auditEvent.create({
      data: {
        workspaceId: args.workspaceId,
        userId: args.userId,
        action: "SUPERVISORY_OUTCOME_ASSIGNED",
        resourceType: "communication_thread",
        resourceId: thread.id,
        metadata: {
          previousOutcome: thread.supervisoryOutcome,
          newOutcome: "ESCALATED",
          reason,
          flagId: flag.id,
          manualEscalation: true,
        },
      },
    });

    return flag.id;
  });

  return { success: true, data: { flagId: result, outcome: "ESCALATED" } };
}

export const supervisionTestHelpers = {
  buildSelectivityStatement,
  summarizeOutcomes,
  parseControlSamplingPolicy,
  requireParkedReason,
  outcomesAreMutuallyExclusive,
};
