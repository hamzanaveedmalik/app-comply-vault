/**
 * Pure (db-free) rules for the email → meeting demo bridge: deterministic flag
 * scanning, counterparty selection, name derivation, and synthesized extraction.
 * Kept separate from email-to-meeting.ts so the logic is unit-testable.
 */

import type {
  ExtractionData,
  ExtractedRecommendation,
  EvidenceMapItem,
} from "~/server/extraction/types";
import type { FlagSeverity, FlagType } from "../../../generated/prisma";

function normalizeAddr(addr: string | undefined | null): string {
  return (addr ?? "").trim().toLowerCase();
}

/** The distinguishing meetingType label for email-sourced interactions. */
export const EMAIL_MEETING_TYPE = "Email";

export type EmailKeywordFlag = {
  type: FlagType;
  severity: FlagSeverity;
  matchedPhrase: string;
  excerpt: string;
  rationale: string;
};

type FlagRule = {
  type: FlagType;
  severity: FlagSeverity;
  patterns: RegExp[];
  rationale: string;
};

// Deterministic content rules so the demo reliably surfaces findings. These are
// heuristic keyword matches (not regulatory citations) — the real LLM classifier
// still runs in parallel via enqueueClassification.
const FLAG_RULES: FlagRule[] = [
  {
    type: "GUARANTEED_RETURN",
    severity: "CRITICAL",
    patterns: [/\bguarantee(d|s)?\b/i, /\brisk[-\s]?free\b/i, /\bcan'?t lose\b/i, /\bno downside\b/i],
    rationale: "Language implies a guaranteed or risk-free return.",
  },
  {
    type: "PERFORMANCE_CLAIM",
    severity: "WARN",
    patterns: [/\bbeat the market\b/i, /\boutperform/i, /\bdouble your\b/i, /\b\d{2,}%\s*(return|gain|annually|per year)\b/i],
    rationale: "Unsubstantiated performance or return projection.",
  },
  {
    type: "CLIENT_COMPLAINT",
    severity: "CRITICAL",
    patterns: [/\bcomplaint\b/i, /\bmisled\b/i, /\bunhappy\b/i, /\bnot happy\b/i, /\bmisrepresent/i],
    rationale: "Possible client complaint requiring supervisory review.",
  },
  {
    type: "OFF_CHANNEL_REFERENCE",
    severity: "WARN",
    patterns: [/\bwhats\s?app\b/i, /\btext me\b/i, /\bmy (personal|cell|mobile)\b/i, /\bsignal app\b/i, /\btelegram\b/i],
    rationale: "Reference to communicating over an unmonitored channel.",
  },
  {
    type: "TRADE_INSTRUCTION",
    severity: "WARN",
    patterns: [/\bsell all\b/i, /\bliquidate\b/i, /\bwire (the|my|\$)/i, /\bmove \$?\d/i, /\bbuy \d+\s*(shares|units)\b/i],
    rationale: "Email contains a trade or money-movement instruction.",
  },
  {
    type: "FEE_DISPUTE",
    severity: "WARN",
    patterns: [/\bovercharged\b/i, /\bfee dispute\b/i, /\brefund\b/i, /\bwrong fee\b/i],
    rationale: "Possible fee dispute raised by the client.",
  },
  {
    type: "SENSITIVE_PII_SHARE",
    severity: "CRITICAL",
    patterns: [/\b\d{3}-\d{2}-\d{4}\b/, /\bsocial security\b/i, /\bssn\b/i, /\baccount number\b/i],
    rationale: "Sensitive PII (e.g. SSN or account number) shared over email.",
  },
  {
    type: "GIFTS_ENTERTAINMENT",
    severity: "INFO",
    patterns: [/\btickets\b/i, /\bgift\b/i, /\bbottle of\b/i, /\bdinner on me\b/i],
    rationale: "Gift or entertainment reference — log for G&E policy.",
  },
];

const ADVICE_PATTERNS: RegExp[] = [
  /\brecommend/i,
  /\bwe should (move|invest|allocate|shift|rebalance)\b/i,
  /\bput (it|everything|your money) (in|into)\b/i,
  /\bi(?:'| a)?m advising\b/i,
  /\bswitch (to|into)\b/i,
];

export function firstSentenceAround(text: string, matchIndex: number): string {
  const start = text.lastIndexOf(".", matchIndex) + 1;
  const endDot = text.indexOf(".", matchIndex);
  const end = endDot === -1 ? Math.min(text.length, matchIndex + 160) : endDot + 1;
  return text.slice(start, end).trim().slice(0, 240);
}

/**
 * Scan email content for deterministic compliance signals. Pure function so it
 * is unit-testable without a database.
 */
export function scanEmailForFlags(subject: string, bodyText: string): EmailKeywordFlag[] {
  const haystack = `${subject}\n${bodyText}`;
  const out: EmailKeywordFlag[] = [];
  const seen = new Set<FlagType>();
  for (const rule of FLAG_RULES) {
    for (const pattern of rule.patterns) {
      const match = pattern.exec(haystack);
      if (match) {
        if (seen.has(rule.type)) break;
        seen.add(rule.type);
        out.push({
          type: rule.type,
          severity: rule.severity,
          matchedPhrase: match[0],
          excerpt: firstSentenceAround(haystack, match.index),
          rationale: rule.rationale,
        });
        break;
      }
    }
  }
  return out;
}

export function cleanDisplayName(name: string | undefined | null): string {
  const trimmed = (name ?? "").trim().replace(/^"|"$/g, "");
  // Ignore names that are just the email address.
  if (!trimmed || trimmed.includes("@")) return "";
  return trimmed.slice(0, 120);
}

export function deriveNameFromAddress(address: string): string {
  const local = address.split("@")[0] ?? address;
  const words = local
    .replace(/[._-]+/g, " ")
    .replace(/\d+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return address;
  return words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

export type Counterparty = { address: string; name: string };

/**
 * The client is the external counterparty — the first participant address that
 * is not the connected mailbox. Prefers the sender for inbound mail.
 */
export function pickCounterparty(args: {
  mailboxAddress: string;
  fromAddress: string;
  fromName?: string | null;
  toRecipients: Array<{ address: string; name?: string | null }>;
  ccRecipients: Array<{ address: string; name?: string | null }>;
}): Counterparty | null {
  const mailbox = normalizeAddr(args.mailboxAddress);
  const from = normalizeAddr(args.fromAddress);
  if (from && from !== mailbox && from !== "unknown") {
    return { address: from, name: cleanDisplayName(args.fromName) };
  }
  for (const r of [...args.toRecipients, ...args.ccRecipients]) {
    const addr = normalizeAddr(r.address);
    if (addr && addr !== mailbox) {
      return { address: addr, name: cleanDisplayName(r.name) };
    }
  }
  return null;
}

export function buildExtraction(subject: string, bodyText: string): ExtractionData {
  const recommendations: ExtractedRecommendation[] = [];
  const evidenceMap: EvidenceMapItem[] = [];

  const adviceMatch = ADVICE_PATTERNS.map((p) => p.exec(bodyText)).find(Boolean);
  if (adviceMatch) {
    const snippet = firstSentenceAround(bodyText, adviceMatch.index);
    const rec: ExtractedRecommendation = {
      text: snippet || subject,
      startTime: 0,
      endTime: 0,
      snippet,
      confidence: 0.6,
    };
    recommendations.push(rec);
    evidenceMap.push({
      field: "recommendation",
      claim: rec.text,
      startTime: 0,
      endTime: 0,
      snippet,
      confidence: 0.6,
      edited: false,
    });
  }

  return {
    topics: subject ? [subject] : [],
    recommendations,
    disclosures: [],
    decisions: [],
    followUps: [],
    evidenceMap,
    extractedAt: new Date().toISOString(),
    provider: "email-import",
    processingTime: 0,
  };
}
