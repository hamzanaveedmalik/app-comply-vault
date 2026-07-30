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
]);

export type CoverageAnswerability = z.infer<typeof CoverageAnswerabilitySchema>;

export type InterpretedScope = {
  people: string[];
  entities: string[];
  dateFrom: string | null;
  dateTo: string | null;
  channels: Array<"EMAIL" | "MEETING">;
  concepts: string[];
  exclusions: string[];
};

export type CoverageStatementItem = {
  label: string;
  status: CoverageAnswerability;
  detail: string;
  missingPeriods?: Array<{ from: string; to: string }>;
  unindexedSources?: string[];
};

export type ConfirmedScope = InterpretedScope & {
  confirmedAt: string;
  confirmedByUserId: string;
};

const MONTH_RANGE =
  /\b((?:january|february|march|april|may|june|july|august|september|october|november|december)\s+20\d{2})\b/gi;
const ISO_RANGE = /\b(20\d{2}-\d{2}-\d{2})\b/g;

/**
 * Heuristic interpretation of a single document-request item.
 * Shown to the CCO for confirmation before any generation.
 */
export function interpretRequestItem(requestText: string): InterpretedScope {
  const text = requestText.trim();
  const lower = text.toLowerCase();

  const people: string[] = [];
  const nameMatches = text.match(
    /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\b/g
  );
  if (nameMatches) {
    for (const n of nameMatches.slice(0, 8)) {
      if (!/^(January|February|March|April|May|June|July|August|September|October|November|December)\b/.test(n)) {
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
  if (!dateFrom && months[0]) {
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
  if (/\bperformance|return/i.test(lower)) concepts.push("performance claims");
  if (/\brecommend/i.test(lower)) concepts.push("recommendations");
  if (/\bcomplaint/i.test(lower)) concepts.push("complaints");
  if (concepts.length === 0) concepts.push("general communications");

  const exclusions: string[] = [];
  if (/\bexclud/i.test(lower)) {
    exclusions.push("Items explicitly excluded in the request text");
  }
  exclusions.push("Channels not connected to this workspace");
  exclusions.push("Periods outside confirmed date range");

  return {
    people: [...new Set(people)],
    entities,
    dateFrom,
    dateTo,
    channels,
    concepts,
    exclusions,
  };
}

export function buildCoverageStatement(args: {
  scope: InterpretedScope;
  meetingCount: number;
  emailCount: number;
  gapPeriods?: Array<{ from: string; to: string; reason: string }>;
  unindexedSources?: string[];
}): CoverageStatementItem[] {
  const items: CoverageStatementItem[] = [];

  for (const channel of args.scope.channels) {
    const count = channel === "EMAIL" ? args.emailCount : args.meetingCount;
    if (count === 0) {
      items.push({
        label: `${channel} candidate records`,
        status: "missing",
        detail: `No ${channel.toLowerCase()} records matched the confirmed scope.`,
        unindexedSources: args.unindexedSources,
      });
    } else if ((args.gapPeriods?.length ?? 0) > 0) {
      items.push({
        label: `${channel} candidate records`,
        status: "partially_answerable",
        detail: `Found ${count} candidate ${channel.toLowerCase()} record(s); known gaps remain.`,
        missingPeriods: args.gapPeriods?.map((g) => ({
          from: g.from,
          to: g.to,
        })),
        unindexedSources: args.unindexedSources,
      });
    } else {
      items.push({
        label: `${channel} candidate records`,
        status: "answerable",
        detail: `Found ${count} candidate ${channel.toLowerCase()} record(s) under the confirmed scope.`,
      });
    }
  }

  if ((args.unindexedSources?.length ?? 0) > 0) {
    items.push({
      label: "Unindexed sources",
      status: "data_source_unavailable",
      detail: `Not searched: ${(args.unindexedSources ?? []).join(", ")}.`,
      unindexedSources: args.unindexedSources,
    });
  }

  items.push({
    label: "Manual confirmation",
    status: "requires_manual_confirmation",
    detail:
      "CCO must review candidate records before any examination use. This pack is labelled candidate, not complete.",
  });

  return items;
}

/** Copy guard: never claim exam readiness. */
export function assertNoExamReadyClaim(text: string): boolean {
  return !/\bexam[- ]?ready\b/i.test(text);
}
