/**
 * Email classification taxonomy + prompt (Email Intelligence Phase 2).
 */

import { z } from "zod";
import type { FlagSeverity, FlagType } from "../../../generated/prisma";

export const EMAIL_FLAG_TYPES = [
  "GUARANTEED_RETURN",
  "PERFORMANCE_CLAIM",
  "CLIENT_COMPLAINT",
  "UNAPPROVED_MARKETING",
  "TRADE_INSTRUCTION",
  "FEE_DISPUTE",
  "OFF_CHANNEL_REFERENCE",
  "SENSITIVE_PII_SHARE",
  "GIFTS_ENTERTAINMENT",
] as const;

export type EmailFlagType = (typeof EMAIL_FLAG_TYPES)[number];

export const EMAIL_CLASSIFICATION_PROMPT_VERSION = "email-taxonomy-v1";

export const emailSignalSchema = z.object({
  category: z.enum(EMAIL_FLAG_TYPES),
  severity: z.enum(["INFO", "WARN", "CRITICAL"]),
  confidence: z.number().min(0).max(1),
  excerpt: z.string().min(1).max(2000),
  rationale: z.string().min(1).max(2000),
});

export const emailClassificationLlmSchema = z.object({
  clean: z.boolean(),
  signals: z.array(emailSignalSchema).default([]),
});

export type EmailClassificationLlmResult = z.infer<typeof emailClassificationLlmSchema>;

export const EMAIL_TAXONOMY_SYSTEM_PROMPT = `You are a compliance triage assistant for a Registered Investment Advisor.
Classify redacted email body text for compliance attention signals only.
Do not invent facts. Do not cite regulations. Return JSON only.

Categories (use exactly these enum values):
- GUARANTEED_RETURN: promissory or guaranteed-return language
- PERFORMANCE_CLAIM: performance claims or past-results promises
- CLIENT_COMPLAINT: client complaint or dissatisfaction
- UNAPPROVED_MARKETING: unapproved marketing content
- TRADE_INSTRUCTION: instruction or trade request received by email
- FEE_DISPUTE: fee dispute or fee disagreement
- OFF_CHANNEL_REFERENCE: reference to off-channel communication (text me, WhatsApp, personal number)
- SENSITIVE_PII_SHARE: sharing of credentials or sensitive PII
- GIFTS_ENTERTAINMENT: gifts and entertainment mentions

If none apply, set clean=true and signals=[].
Each signal must include category, severity (INFO|WARN|CRITICAL), confidence (0-1),
a short redacted excerpt that triggered it, and a plain-English rationale.

JSON shape:
{"clean":boolean,"signals":[{"category":"...","severity":"WARN","confidence":0.8,"excerpt":"...","rationale":"..."}]}`;

/** Stage-1 heuristic prefilter — cheap keyword gate before LLM. */
const HEURISTIC_PATTERNS: Array<{ type: EmailFlagType; re: RegExp }> = [
  { type: "GUARANTEED_RETURN", re: /\b(guarantees?|guaranteed returns?|can't lose|risk[- ]free)\b/i },
  { type: "PERFORMANCE_CLAIM", re: /\b(outperform|beat the market|alpha|past performance|returns of)\b/i },
  { type: "CLIENT_COMPLAINT", re: /\b(complaint|unhappy|disappointed|frustrated|upset with)\b/i },
  { type: "UNAPPROVED_MARKETING", re: /\b(promo|promotion|special offer|limited time)\b/i },
  { type: "TRADE_INSTRUCTION", re: /\b(buy|sell|execute|trade|liquidate|market order)\b/i },
  { type: "FEE_DISPUTE", re: /\b(fee|fees|billing|overcharg|invoice dispute)\b/i },
  { type: "OFF_CHANNEL_REFERENCE", re: /\b(whatsapp|text me|sms|personal (cell|phone|number)|signal app|telegram)\b/i },
  { type: "SENSITIVE_PII_SHARE", re: /\b(password|ssn|social security|login|credentials|account number)\b/i },
  { type: "GIFTS_ENTERTAINMENT", re: /\b(gift|dinner|tickets|entertainment|golf outing)\b/i },
];

export function heuristicEmailPrefilter(redactedText: string): {
  candidate: boolean;
  matchedTypes: EmailFlagType[];
} {
  const matchedTypes: EmailFlagType[] = [];
  for (const { type, re } of HEURISTIC_PATTERNS) {
    if (re.test(redactedText)) matchedTypes.push(type);
  }
  return { candidate: matchedTypes.length > 0, matchedTypes };
}

export function defaultSeverityForType(type: EmailFlagType): FlagSeverity {
  switch (type) {
    case "GUARANTEED_RETURN":
    case "SENSITIVE_PII_SHARE":
    case "TRADE_INSTRUCTION":
      return "CRITICAL";
    case "PERFORMANCE_CLAIM":
    case "CLIENT_COMPLAINT":
    case "FEE_DISPUTE":
    case "OFF_CHANNEL_REFERENCE":
      return "WARN";
    default:
      return "INFO";
  }
}

export function emailFlagDedupeKey(communicationId: string, type: FlagType): string {
  return `email:${communicationId}:${type}`;
}
