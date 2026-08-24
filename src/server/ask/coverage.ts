/**
 * CV-AX-06 — Index coverage manifest and honest-miss outcomes.
 * Never answers from nearest available material when out of coverage.
 */

export type IndexedSourceRange = {
  sourceType: "EMAIL" | "MEETING";
  from: string | null;
  to: string | null;
  chunkCount: number;
};

export type CoverageGap = {
  sourceType: "EMAIL" | "MEETING" | "OTHER";
  from: string;
  to: string;
  reason: string;
};

export type IndexCoverageManifest = {
  workspaceId: string;
  sources: IndexedSourceRange[];
  gapPeriods: CoverageGap[];
  /** Deliberately unindexed channels/sources for demo honest-miss. */
  unindexedSources: Array<{
    name: string;
    reason: string;
  }>;
  lastIndexedAt: string | null;
};

export type HonestMissReason =
  | "unindexed_source"
  | "out_of_range"
  | "below_threshold"
  | "no_evidence";

export type HonestMissOutcome = {
  kind: "honest-miss";
  missReason: HonestMissReason;
  message: string;
  coveredRanges: IndexedSourceRange[];
  missing: string;
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}/;

function parseQuestionDateHints(question: string): string[] {
  const matches = question.match(/\b(20\d{2}-\d{2}-\d{2})\b/g) ?? [];
  const yearMonths =
    question.match(
      /\b((?:January|February|March|April|May|June|July|August|September|October|November|December)\s+20\d{2})\b/gi
    ) ?? [];
  return [...matches, ...yearMonths];
}

/**
 * Build a coverage manifest from embedding aggregate stats + optional seed gaps.
 */
export function buildCoverageManifest(args: {
  workspaceId: string;
  emailFrom: Date | null;
  emailTo: Date | null;
  emailChunks: number;
  meetingFrom: Date | null;
  meetingTo: Date | null;
  meetingChunks: number;
  lastIndexedAt: Date | null;
  gapPeriods?: CoverageGap[];
  unindexedSources?: IndexCoverageManifest["unindexedSources"];
}): IndexCoverageManifest {
  const sources: IndexedSourceRange[] = [];
  if (args.emailChunks > 0 || args.emailFrom || args.emailTo) {
    sources.push({
      sourceType: "EMAIL",
      from: args.emailFrom?.toISOString() ?? null,
      to: args.emailTo?.toISOString() ?? null,
      chunkCount: args.emailChunks,
    });
  }
  if (args.meetingChunks > 0 || args.meetingFrom || args.meetingTo) {
    sources.push({
      sourceType: "MEETING",
      from: args.meetingFrom?.toISOString() ?? null,
      to: args.meetingTo?.toISOString() ?? null,
      chunkCount: args.meetingChunks,
    });
  }
  return {
    workspaceId: args.workspaceId,
    sources,
    gapPeriods: args.gapPeriods ?? [],
    unindexedSources: args.unindexedSources ?? [],
    lastIndexedAt: args.lastIndexedAt?.toISOString() ?? null,
  };
}

/**
 * Decide whether the question is outside index coverage.
 * Returns an honest miss instead of answering from nearest material.
 */
export function evaluateHonestMiss(args: {
  question: string;
  manifest: IndexCoverageManifest;
  matchCount: number;
  belowThreshold: boolean;
  requestedChannel?: "EMAIL" | "MEETING" | "SMS" | "TEAMS" | "OTHER";
}): HonestMissOutcome | null {
  const q = args.question.toLowerCase();

  for (const unindexed of args.manifest.unindexedSources) {
    const token = unindexed.name.toLowerCase();
    if (token && q.includes(token)) {
      return {
        kind: "honest-miss",
        missReason: "unindexed_source",
        message: `I cannot answer from ${unindexed.name}: that source is not indexed. I will not infer from nearby material. ${describeCoverage(args.manifest)}`,
        coveredRanges: args.manifest.sources,
        missing: unindexed.name,
      };
    }
  }

  if (
    args.requestedChannel &&
    args.requestedChannel !== "EMAIL" &&
    args.requestedChannel !== "MEETING"
  ) {
    return {
      kind: "honest-miss",
      missReason: "unindexed_source",
      message: `I cannot answer from ${args.requestedChannel}: that channel is not indexed. ${describeCoverage(args.manifest)}`,
      coveredRanges: args.manifest.sources,
      missing: args.requestedChannel,
    };
  }

  // Out-of-range: explicit ISO date in question outside all indexed ranges
  const isoDates = (args.question.match(/\b(20\d{2}-\d{2}-\d{2})\b/g) ?? []).filter(
    (d) => ISO_DATE.test(d)
  );
  for (const dateStr of isoDates) {
    const t = new Date(`${dateStr}T12:00:00.000Z`).getTime();
    const inRange = args.manifest.sources.some((s) => {
      if (!s.from || !s.to) return false;
      const from = new Date(s.from).getTime();
      const to = new Date(s.to).getTime();
      return t >= from && t <= to;
    });
    if (!inRange && args.manifest.sources.length > 0) {
      return {
        kind: "honest-miss",
        missReason: "out_of_range",
        message: `No indexed evidence covers ${dateStr}. ${describeCoverage(args.manifest)} I will not answer from nearest available material.`,
        coveredRanges: args.manifest.sources,
        missing: `date ${dateStr}`,
      };
    }
  }

  // Seeded gap periods
  for (const gap of args.manifest.gapPeriods) {
    if (q.includes(gap.from.slice(0, 7)) || q.includes(gap.reason.toLowerCase())) {
      return {
        kind: "honest-miss",
        missReason: "out_of_range",
        message: `Indexed coverage has a gap from ${gap.from} to ${gap.to} (${gap.reason}). ${describeCoverage(args.manifest)}`,
        coveredRanges: args.manifest.sources,
        missing: `${gap.from}–${gap.to}`,
      };
    }
  }

  if (args.belowThreshold) {
    return {
      kind: "honest-miss",
      missReason: "below_threshold",
      message: `Retrieval confidence is below threshold for this question. ${describeCoverage(args.manifest)} I will not invent or stretch adjacent material into an answer.`,
      coveredRanges: args.manifest.sources,
      missing: "sufficient-confidence matches",
    };
  }

  if (args.matchCount === 0) {
    // Prefer specific miss when question hints at dates/channels we can name
    const hints = parseQuestionDateHints(args.question);
    return {
      kind: "honest-miss",
      missReason: "no_evidence",
      message: `No matching evidence in the indexed corpus${hints.length ? ` for the period hinted (${hints.join(", ")})` : ""}. ${describeCoverage(args.manifest)}`,
      coveredRanges: args.manifest.sources,
      missing: "matching evidence",
    };
  }

  return null;
}

export function describeCoverage(manifest: IndexCoverageManifest): string {
  if (manifest.sources.length === 0) {
    return "No sources are currently indexed for this workspace.";
  }
  const parts = manifest.sources.map((s) => {
    const range =
      s.from && s.to
        ? `${s.from.slice(0, 10)} to ${s.to.slice(0, 10)}`
        : "date range unknown";
    return `${s.sourceType} (${s.chunkCount} chunks, ${range})`;
  });
  const last = manifest.lastIndexedAt
    ? ` Last indexed ${manifest.lastIndexedAt.slice(0, 10)}.`
    : "";
  return `Indexed: ${parts.join("; ")}.${last}`;
}

/** Demo-seeded default gaps for honest-miss rehearsals. */
export const DEMO_COVERAGE_DEFAULTS: Pick<
  IndexCoverageManifest,
  "gapPeriods" | "unindexedSources"
> = {
  gapPeriods: [
    {
      sourceType: "EMAIL",
      from: "2024-01-01",
      to: "2024-03-31",
      reason: "Mailbox not connected for Q1 2024",
    },
  ],
  unindexedSources: [
    { name: "SMS", reason: "SMS channel not connected" },
    { name: "WhatsApp", reason: "Off-channel upload not indexed for Ask" },
    { name: "Teams chat", reason: "Teams chat not in demo index" },
  ],
};
