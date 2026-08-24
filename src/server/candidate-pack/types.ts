/**
 * CV-XR — Candidate Response Pack types and scope interpretation.
 * The word "responsive" appears nowhere.
 */

import { z } from "zod";

export const CandidatePackStatusSchema = z.enum([
  "DRAFT_SCOPE",
  "SCOPE_CONFIRMED",
  "GENERATED",
  "APPROVED",
]);

export type CandidatePackStatus = z.infer<typeof CandidatePackStatusSchema>;

export const CoverageAnswerabilitySchema = z.enum([
  "answerable",
  "partially_answerable",
  "missing",
  "requires_manual_confirmation",
  "data_source_unavailable",
  "excluded_by_request",
]);

export type CoverageAnswerability = z.infer<typeof CoverageAnswerabilitySchema>;

export type InterpretedScope = {
  people: string[];
  entities: string[];
  dateFrom: string | null;
  dateTo: string | null;
  channels: Array<"EMAIL" | "MEETING">;
  concepts: string[];
  /** Specific channels/topics excluded by the request text. */
  exclusions: string[];
};

export type CoverageStatementItem = {
  label: string;
  status: CoverageAnswerability;
  detail: string;
  missingPeriods?: Array<{ from: string; to: string }>;
  unindexedSources?: string[];
  /** Request-quoted exclusion text when status is excluded_by_request. */
  requestQuote?: string;
};

export type ConfirmedScope = InterpretedScope & {
  confirmedAt: string;
  confirmedByUserId: string;
};

export type CandidateEvidenceRow = {
  id: string;
  kind: "EMAIL" | "MEETING";
  occurredAt: string | null;
  title: string;
  subtitle: string;
  sourceSystem: string;
  hashPrefix: string | null;
  matchReason: string;
};

const MONTH_RANGE =
  /\b((?:january|february|march|april|may|june|july|august|september|october|november|december)\s+20\d{2})\b/gi;
const ISO_RANGE = /\b(20\d{2}-\d{2}-\d{2})\b/g;

const MONTH_INDEX: Record<string, number> = {
  january: 1,
  february: 2,
  march: 3,
  april: 4,
  may: 5,
  june: 6,
  july: 7,
  august: 8,
  september: 9,
  october: 10,
  november: 11,
  december: 12,
};

const TWELVE_MONTH_ENDING =
  /\b(?:(?:a|the)\s+)?(?:twelve|12)[\s-]*month(?:s)?\s+(?:period\s+)?ending\s+(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(20\d{2})\b/i;

function toIsoDate(year: number, month: number, day: number): string {
  const iso = new Date(Date.UTC(year, month - 1, day)).toISOString();
  return iso.slice(0, 10);
}

/** Dedupe gap rows that share the same window (email + meeting often mirror). */
export function uniqueGapPeriods<T extends { from: string; to: string }>(
  gaps: T[],
): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const gap of gaps) {
    const key = `${gap.from}|${gap.to}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(gap);
  }
  return out;
}

const EXCLUSION_PATTERNS: Array<{ re: RegExp; label: string }> = [
  { re: /\bsms\b/i, label: "SMS" },
  { re: /\bwhatsapp\b/i, label: "WhatsApp" },
  { re: /\btext messages?\b/i, label: "text messages" },
  { re: /\bpersonal messag/i, label: "personal messaging" },
  { re: /\boff[- ]channel\b/i, label: "off-channel messaging" },
  { re: /\bteams chat\b/i, label: "Teams chat" },
  { re: /\bslack\b/i, label: "Slack" },
  { re: /\biMessage\b/i, label: "iMessage" },
];

/**
 * Heuristic interpretation of a single document-request item.
 * Shown to the CCO for confirmation before any generation.
 */
export function interpretRequestItem(requestText: string): InterpretedScope {
  const text = requestText.trim();
  const lower = text.toLowerCase();

  const people: string[] = [];
  const nameMatches = text.match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\b/g);
  if (nameMatches) {
    for (const n of nameMatches.slice(0, 8)) {
      if (
        !/^(January|February|March|April|May|June|July|August|September|October|November|December)\b/.test(
          n
        )
      ) {
        people.push(n);
      }
    }
  }

  const entities: string[] = [];
  if (/\b(firm|adviser|advisor|ria)\b/i.test(text)) {
    entities.push("Adviser firm (workspace)");
  }

  const isoDates = text.match(ISO_RANGE) ?? [];
  const months = text.match(MONTH_RANGE) ?? [];
  let dateFrom: string | null = isoDates[0] ?? null;
  let dateTo: string | null = isoDates[1] ?? isoDates[0] ?? null;

  const twelveMonth = text.match(TWELVE_MONTH_ENDING);
  if (twelveMonth) {
    const day = Number(twelveMonth[1]);
    const monthName = twelveMonth[2]!.toLowerCase();
    const year = Number(twelveMonth[3]);
    const month = MONTH_INDEX[monthName];
    if (month && day >= 1 && day <= 31) {
      dateTo = toIsoDate(year, month, day);
      dateFrom = toIsoDate(year - 1, month, day);
    }
  } else if (!dateFrom && months[0]) {
    dateFrom = months[0];
    dateTo = months[1] ?? months[0];
  }

  const channels: Array<"EMAIL" | "MEETING"> = [];
  if (/\b(email|correspondence|mailbox)\b/i.test(lower)) channels.push("EMAIL");
  if (/\b(meeting|call|zoom|teams meeting|transcript)\b/i.test(lower)) {
    channels.push("MEETING");
  }
  if (channels.length === 0) {
    channels.push("EMAIL", "MEETING");
  }

  const concepts: string[] = [];
  if (/\bfee/i.test(lower)) concepts.push("fees");
  if (/\bsuitab/i.test(lower)) concepts.push("suitability");
  if (/\bperformance|return/i.test(lower)) concepts.push("performance claims");
  if (/\brecommend/i.test(lower)) concepts.push("recommendations");
  if (/\bcomplaint/i.test(lower)) concepts.push("complaints");
  if (concepts.length === 0) concepts.push("general communications");

  const exclusions: string[] = [];
  if (/\bexclud/i.test(lower) || /\bexcept\b/i.test(lower)) {
    for (const { re, label } of EXCLUSION_PATTERNS) {
      if (re.test(text)) exclusions.push(label);
    }
    if (exclusions.length === 0) {
      const afterExclude = text.match(
        /\bexclud(?:e|ing|es)\s+([^.;]+)/i
      )?.[1];
      if (afterExclude) {
        exclusions.push(afterExclude.trim().replace(/\s+/g, " "));
      }
    }
  }

  return {
    people: [...new Set(people)],
    entities,
    dateFrom,
    dateTo,
    channels,
    concepts,
    exclusions: [...new Set(exclusions)],
  };
}

function channelLabel(channel: "EMAIL" | "MEETING"): string {
  return channel === "EMAIL" ? "email" : "meeting";
}

/**
 * Coverage for the confirmed scope.
 * Request exclusions are reported separately from unindexed / unavailable sources.
 */
export function buildCoverageStatement(args: {
  scope: InterpretedScope;
  meetingCount: number;
  emailCount: number;
  gapPeriods?: Array<{ from: string; to: string; reason: string }>;
  unindexedSources?: string[];
  searchPopulation?: SearchPopulation;
}): CoverageStatementItem[] {
  const items: CoverageStatementItem[] = [];
  const excludedSet = new Set(
    args.scope.exclusions.map((e) => e.toLowerCase())
  );

  if (args.searchPopulation) {
    items.push({
      label: "Search population",
      status: "answerable",
      detail: searchPopulationSummary(args.searchPopulation),
    });
  }

  const gaps = uniqueGapPeriods(args.gapPeriods ?? []);

  for (const channel of args.scope.channels) {
    const count = channel === "EMAIL" ? args.emailCount : args.meetingCount;
    const noun = channelLabel(channel);
    if (count === 0) {
      items.push({
        label: `${channel === "EMAIL" ? "Email" : "Meeting"} candidate records`,
        status: "missing",
        detail: `No matches in the ${noun} sources searched under the confirmed scope.`,
      });
    } else if (gaps.length > 0) {
      const windowSummary = gaps
        .map((g) => `${g.from} to ${g.to}`)
        .join("; ");
      items.push({
        label: `${channel === "EMAIL" ? "Email" : "Meeting"} candidate records`,
        status: "partially_answerable",
        detail: `Found ${count} candidate ${noun} record${count === 1 ? "" : "s"} under the confirmed scope. Indexed coverage does not include ${windowSummary}.`,
        missingPeriods: gaps.map((g) => ({
          from: g.from,
          to: g.to,
        })),
      });
    } else {
      items.push({
        label: `${channel === "EMAIL" ? "Email" : "Meeting"} candidate records`,
        status: "answerable",
        detail: `Found ${count} candidate ${noun} record${count === 1 ? "" : "s"} under the confirmed scope.`,
      });
    }
  }

  for (const gap of gaps) {
    items.push({
      label: "Coverage gap",
      status: "partially_answerable",
      detail: `${gap.from} to ${gap.to}: ${gap.reason}`,
      missingPeriods: [{ from: gap.from, to: gap.to }],
    });
  }

  if (args.scope.exclusions.length > 0) {
    items.push({
      label: "Excluded by request",
      status: "excluded_by_request",
      detail: `Not searched because the request excluded: ${args.scope.exclusions.join(", ")}.`,
      requestQuote: args.scope.exclusions.join(", "),
    });
  }

  const actionableUnindexed = (args.unindexedSources ?? []).filter(
    (source) =>
      !excludedSet.has(source.toLowerCase()) &&
      ![...excludedSet].some(
        (ex) =>
          source.toLowerCase().includes(ex) ||
          ex.includes(source.toLowerCase())
      )
  );
  if (actionableUnindexed.length > 0) {
    items.push({
      label: "Not connected to this workspace",
      status: "data_source_unavailable",
      detail: `These sources are not connected, so they were not searched: ${actionableUnindexed.join(", ")}.`,
      unindexedSources: actionableUnindexed,
    });
  }

  items.push({
    label: "Manual confirmation",
    status: "requires_manual_confirmation",
    detail:
      "You must review candidate records before any examination use. This pack is labelled candidate, not complete.",
  });

  return items;
}

/** Copy guard: never claim exam readiness. */
export function assertNoExamReadyClaim(text: string): boolean {
  return !/\bexam[- ]?ready\b/i.test(text);
}

/**
 * User-facing labels for coverage statuses.
 * CV-VL-01: never use bare "answerable" / "partially answerable" — those read
 * as exam-response completeness claims. Enum values stay stable for storage.
 */
export function coverageStatusLabel(status: CoverageAnswerability): string {
  switch (status) {
    case "answerable":
      return "Matches under scope";
    case "partially_answerable":
      return "Partial matches — gaps remain";
    case "missing":
      return "No matches";
    case "requires_manual_confirmation":
      return "Action required";
    case "data_source_unavailable":
      return "Not connected";
    case "excluded_by_request":
      return "Excluded by request";
    default:
      return status;
  }
}

export type SearchPopulation = {
  emailsScanned: number;
  meetingsScanned: number;
  emailsMatched: number;
  meetingsMatched: number;
  sourcesConnected: Array<"EMAIL" | "MEETING">;
};

export function searchPopulationSummary(pop: SearchPopulation): string {
  const parts: string[] = [];
  if (pop.sourcesConnected.includes("EMAIL")) {
    parts.push(
      `${pop.emailsScanned} email${pop.emailsScanned === 1 ? "" : "s"}`
    );
  }
  if (pop.sourcesConnected.includes("MEETING")) {
    parts.push(
      `${pop.meetingsScanned} meeting${pop.meetingsScanned === 1 ? "" : "s"}`
    );
  }
  const sources = pop.sourcesConnected
    .map((s) => (s === "EMAIL" ? "email" : "meeting capture"))
    .join(" and ");
  return `Searched ${parts.join(" and ")} across ${pop.sourcesConnected.length} connected source${pop.sourcesConnected.length === 1 ? "" : "s"} (${sources}).`;
}
