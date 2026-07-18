/**
 * Illustrative seed data for the AdvizorStack partner demo.
 * None of this is real client, firm, or regulatory data — it exists only to
 * storyboard the ComplyVault review experience. Never wire any of it to real
 * auth, capture sources, or the Hadrius destination.
 */

export const DEMO_BASE_PATH = "/demo/advizorStack";

export type Severity = "high" | "medium";

export type SyncStatus = "synced" | "pending";

export type DemoFinding = {
  title: string;
  detail: string;
  /** Confirmed high-risk findings are the only place red is used. */
  highRisk?: boolean;
};

export type QueueItem = {
  id: string;
  /** Client / household name. */
  name: string;
  /** Firm the interaction belongs to. */
  firm: string;
  /** One-line reason the interaction was surfaced. */
  reason: string;
  severity: Severity;
  syncStatus: SyncStatus;
  /**
   * Relationship value is the primary sort key. Higher means a more valuable
   * relationship, which lifts the item up the queue ahead of raw severity.
   */
  relationshipValue: number;
  /** Marks a top-tier relationship in the ranked list. */
  topRelationship: boolean;
  adviser: string;
  source: string;
  headline: string;
  findings: DemoFinding[];
  transcript: {
    timestamp: string;
    speaker: string;
    excerpt: string;
  };
  why: string;
};

/**
 * Ordered by relationship value first, then severity. Kept pre-sorted so the
 * queue renders deterministically for the demo.
 */
export const QUEUE_ITEMS: QueueItem[] = [
  {
    id: "wilson-household",
    name: "Wilson household",
    firm: "Summit Ridge Wealth",
    reason: "Fee disclosure gap in rollover discussion · top 5 relationship",
    severity: "high",
    syncStatus: "synced",
    relationshipValue: 98,
    topRelationship: true,
    adviser: "Michael Turner",
    source: "Zocks",
    headline: "Rollover and retirement planning review",
    findings: [
      {
        title: "Possible fee disclosure gap",
        detail:
          "Advisory account discussed, resulting fee not clearly explained.",
      },
      {
        title: "Rollover recommendation",
        detail: "Recommendation to move retirement assets identified.",
      },
      {
        title: "Conflict disclosure present",
        detail: "Compensation arrangement disclosed. No action required.",
      },
    ],
    transcript: {
      timestamp: "14:32",
      speaker: "Adviser",
      excerpt:
        "We could consolidate the old 401(k) into the managed account\u2026",
    },
    why: "A rollover recommendation and managed-account discussion were detected, but no clear fee comparison was found nearby.",
  },
  {
    id: "chen-family-trust",
    name: "Chen family trust",
    firm: "Anker Wealth Partners",
    reason: "Rollover recommendation, no fee comparison found",
    severity: "high",
    syncStatus: "synced",
    relationshipValue: 82,
    topRelationship: false,
    adviser: "Priya Anand",
    source: "Zocks",
    headline: "Rollover recommendation without fee comparison",
    findings: [
      {
        title: "Rollover recommendation",
        detail: "Move of retirement assets recommended during the meeting.",
      },
      {
        title: "No fee comparison found",
        detail:
          "No side-by-side cost comparison was detected in the surrounding context.",
      },
    ],
    transcript: {
      timestamp: "09:47",
      speaker: "Adviser",
      excerpt:
        "Rolling it over keeps everything under one roof so we can manage it together\u2026",
    },
    why: "A rollover recommendation was detected without a nearby comparison of costs between the existing plan and the managed account.",
  },
  {
    id: "patterson-ira",
    name: "Patterson IRA",
    firm: "Meridian Advisory",
    reason: "Suitability rationale incomplete on annuity switch",
    severity: "medium",
    syncStatus: "pending",
    relationshipValue: 61,
    topRelationship: false,
    adviser: "David Ruiz",
    source: "Email (M365)",
    headline: "Suitability rationale incomplete on annuity switch",
    findings: [
      {
        title: "Annuity switch discussed",
        detail: "A replacement of an existing annuity contract was raised.",
      },
      {
        title: "Suitability rationale incomplete",
        detail:
          "The documented reasoning for the switch did not cover surrender costs.",
      },
    ],
    transcript: {
      timestamp: "16:05",
      speaker: "Adviser",
      excerpt:
        "The new contract has a better income rider, so it makes sense to move\u2026",
    },
    why: "An annuity replacement was detected, but the surrounding notes did not clearly weigh surrender charges against the stated benefit.",
  },
  {
    id: "nakamura-joint-account",
    name: "Nakamura joint account",
    firm: "Northstar Financial",
    reason: "Conflict disclosure wording out of date",
    severity: "medium",
    syncStatus: "synced",
    relationshipValue: 54,
    topRelationship: false,
    adviser: "Sarah Kline",
    source: "Zocks",
    headline: "Conflict disclosure wording out of date",
    findings: [
      {
        title: "Conflict disclosure present",
        detail: "A conflict of interest disclosure was made verbally.",
      },
      {
        title: "Wording out of date",
        detail:
          "The phrasing does not match the firm's current approved template.",
      },
    ],
    transcript: {
      timestamp: "11:18",
      speaker: "Adviser",
      excerpt:
        "Just so you know, we may earn a commission on some of these products\u2026",
    },
    why: "A conflict disclosure was detected, but the wording differs from the firm's current approved language.",
  },
];

export const QUEUE_CLEAR_COUNT = 186;
export const TOTAL_CAPTURED = 142;
export const TOTAL_REVIEWED = 141;
export const MEDIAN_REVIEW_TIME = "38m";

export function getQueueItem(id: string): QueueItem | undefined {
  return QUEUE_ITEMS.find((item) => item.id === id);
}

export type CaptureSource = {
  name: string;
  detail: string;
  connected: boolean;
};

export const CAPTURE_SOURCES: CaptureSource[] = [
  {
    name: "Zocks",
    detail: "96 meeting transcripts this month",
    connected: true,
  },
  {
    name: "Email (M365)",
    detail: "46 client threads this month",
    connected: true,
  },
  {
    name: "Teams",
    detail: "Not connected yet",
    connected: false,
  },
];

export const HADRIUS_PAYOFF =
  "Hadrius tells you what happened across the firm. ComplyVault proves a human looked at the one thing that mattered.";

export type RiskFlag = {
  label: string;
  /** Drives the status dot colour: "high" → danger, everything else → warning. */
  tone: "high" | "attention" | "info";
  /** Short (<=5 word) reason shown right-aligned in the ranked list. */
  reason: string;
  /**
   * Slug used as the Review Queue filter param (`?risk=<tag>`).
   * TODO: once risk drivers are tied to live Flag/Meeting records, map this tag
   * to a real flag query + surface a count. Today it is firm-metadata only.
   */
  riskTag: string;
  /** Lower-case fragment used to compose the firm summary sentence. */
  summaryPhrase: string;
  /** Longer copy retained for reference; not rendered in the ranked list. */
  explanation: string;
};

export const DEMO_FIRM = {
  name: "Secure Investment Management, LLC",
  location: "Tucson, AZ",
  crd: "141195",
  aum: "$42.9M AUM",
};

/**
 * Ordered by scrutiny impact (highest first). Derived from illustrative CRD /
 * firm-metadata, not live Flag records — see the TODO on `riskTag`.
 */
export const RISK_FLAGS: RiskFlag[] = [
  {
    label: "Regulatory history",
    tone: "high",
    reason: "tops the review queue",
    riskTag: "regulatory-history",
    summaryPhrase: "prior regulatory action",
    explanation:
      "Prior regulatory action means related meetings are ranked at the top of the review queue.",
  },
  {
    label: "Insurance affiliate",
    tone: "attention",
    reason: "insurance and comp lifted",
    riskTag: "insurance-affiliate",
    summaryPhrase: "an insurance affiliate",
    explanation:
      "Insurance and compensation topics are lifted higher in the queue for this firm.",
  },
  {
    label: "Multi-state activity",
    tone: "attention",
    reason: "wider disclosure set",
    riskTag: "multi-state",
    summaryPhrase: "multi-state activity",
    explanation:
      "Cross-state activity widens the set of disclosures checked on each interaction.",
  },
  {
    label: "Pooled vehicle mentions",
    tone: "attention",
    reason: "suitability and conflicts up",
    riskTag: "pooled-vehicle",
    summaryPhrase: "pooled vehicle exposure",
    explanation:
      "Private fund mentions raise the priority of suitability and conflict findings.",
  },
];

const COUNT_WORDS = [
  "zero",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
];

function countWord(n: number): string {
  return COUNT_WORDS[n] ?? String(n);
}

/**
 * Composes the single "why this firm is above baseline" sentence from whichever
 * risk factors are active — intentionally not hard-coded per firm. Leads with
 * the top one or two drivers, then states the total factor count.
 */
export function composeRiskSummary(flags: RiskFlag[]): string {
  if (flags.length === 0) {
    return "No elevated risk factors — this firm sits at baseline scrutiny.";
  }

  const lead = flags.slice(0, 2).map((flag) => flag.summaryPhrase);
  const leadClause = lead.join(" and ");
  const sentenceCaseLead =
    leadClause.charAt(0).toUpperCase() + leadClause.slice(1);

  return `${sentenceCaseLead} put this firm above baseline scrutiny — ${countWord(
    flags.length,
  )} factors widen what gets checked on every meeting.`;
}

/** Where per-workspace disclosure configuration is actually edited in the app. */
export const DISCLOSURE_CONFIG_PATH = "/compliance-cockpit";

export type Disclosure = {
  item: string;
  reference: string;
};

/** Always required, never toggled off. */
export const LOCKED_DISCLOSURES: Disclosure[] = [
  { item: "Conflicts of interest", reference: "Part 2A · Item 10" },
  { item: "Insurance compensation", reference: "Part 2A · Item 10" },
  { item: "Disciplinary history", reference: "Part 2A · Item 9" },
];

/** Configurable, all currently required in this illustrative firm. */
export const CONFIGURABLE_DISCLOSURES: Disclosure[] = [
  { item: "Fees and compensation", reference: "Part 2A · Item 5" },
  { item: "Suitability of recommendations", reference: "Part 2A · Item 8" },
  { item: "Custody arrangements", reference: "Part 2A · Item 15" },
  { item: "Types of clients", reference: "Part 2A · Item 7" },
  { item: "Methods of analysis", reference: "Part 2A · Item 8" },
  { item: "Brokerage practices", reference: "Part 2A · Item 12" },
  { item: "Review of accounts", reference: "Part 2A · Item 13" },
  { item: "Client referrals", reference: "Part 2A · Item 14" },
  { item: "Investment discretion", reference: "Part 2A · Item 16" },
];
