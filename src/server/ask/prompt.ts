/**
 * Ask ComplyVault — system prompt and user-message builder.
 *
 * The system prompt is intentionally locked: every claim must be grounded in
 * the evidence block we ship. No regulatory citations, no hallucinated SEC
 * rules. See PRD §5.4 and §6.2.
 *
 * Only the strings in this file may ever appear in the LLM call. Treat them
 * as pre-approved template strings — do not parameterise from user input
 * beyond the question itself and the evidence we retrieved from the user's
 * own workspace.
 */

import type { ScoredEvidence } from "./types";
import { topicToString, type TopicEntry } from "~/lib/topics";

/**
 * Verbatim from PRD §5.4. Do not edit without compliance review.
 */
export const SYSTEM_PROMPT = `You are ComplyVault, a compliance assistant for Registered Investment Advisors.

You answer questions ONLY about the meeting and email evidence provided to you below. Follow these
rules without exception:

1. NEVER invent facts. If the evidence does not answer the question, reply exactly:
   "I don't have evidence for that in your meeting records."
   When the evidence block contains only email correspondence and still does not answer, reply exactly:
   "No matching correspondence found in your workspace."

2. NEVER cite SEC rules, CFR sections, or external regulations. You may only quote
   text that appears in the evidence block.

3. Every factual claim in your answer must correspond to at least one of the sources
   in the evidence. When you make a claim, mention the client name and date
   inline (e.g. "On May 14 with Rob Cabrera, ..."). For email, mention that it was
   an email and include the evidence hash when provided.

4. Keep answers under 120 words. Plain prose. No markdown headers, no bullet points
   unless the user explicitly asks for a list.

5. If the evidence is conflicting or ambiguous, say so plainly. Do not pick a side.

6. Never repeat or summarise the user's question.
7. Never answer from general knowledge about a client. Only use the evidence block.`;

/**
 * Verbatim string the model must produce when retrieval is empty. We also
 * surface the same string client-side when retrieval returns nothing so the
 * LLM is never called (saves cost — see PRD §7).
 */
export const NO_EVIDENCE_ANSWER =
  "I don't have evidence for that in your meeting records.";

/**
 * Used when Email Intelligence is on and retrieval finds no meetings or email.
 */
export const NO_CORRESPONDENCE_ANSWER =
  "No matching correspondence found in your workspace.";

/**
 * Verbatim string we substitute when the LLM output trips the regulatory
 * citation post-filter. Pre-approved — see PRD §6.2.
 */
export const BLOCKED_REGULATORY_ANSWER =
  "I generated regulatory text I wasn't authorised to produce. Please rephrase the question.";

function formatDateUtc(date: Date): string {
  // YYYY-MM-DD only — keeps the evidence block compact and avoids timezone noise
  // that the LLM would otherwise have to reason about.
  return date.toISOString().slice(0, 10);
}

function shorten(text: string, max: number): string {
  const trimmed = text.replace(/\s+/g, " ").trim();
  if (trimmed.length <= max) return trimmed;
  return trimmed.slice(0, max - 1).trimEnd() + "…";
}

type ExtractionShape = {
  topics?: Array<TopicEntry>;
  recommendations?: Array<{ text?: string; startTime?: number }>;
  disclosures?: Array<{ text?: string; startTime?: number }>;
  decisions?: Array<{ text?: string; startTime?: number }>;
  followUps?: Array<{ text?: string; startTime?: number }>;
};

/**
 * Build the `<evidence>...</evidence>` block + question payload.
 *
 * The block is structured (not free-form) so a downstream parser could
 * audit what the model was shown.
 */
export function buildUserMessage(
  question: string,
  evidence: ScoredEvidence[]
): string {
  const lines: string[] = ["<evidence>"];

  for (const item of evidence) {
    const { candidate, excerpts } = item;
    const date = formatDateUtc(candidate.meetingDate);
    const extraction = (candidate.extraction ?? {}) as ExtractionShape;
    const topics = Array.isArray(extraction.topics)
      ? extraction.topics.map(topicToString).filter(Boolean).slice(0, 5)
      : [];

    lines.push(
      candidate.sourceType === "EMAIL"
        ? `[email:${candidate.threadId ?? candidate.id}] ${candidate.clientName} · Email · ${date}${candidate.contentSha256 ? ` · hash:${candidate.contentSha256.slice(0, 12)}` : ""}`
        : `[meeting:${candidate.id}] ${candidate.clientName} · ${candidate.meetingType} · ${date}`
    );
    if (topics.length > 0) {
      lines.push(`  topics: ${topics.map((t) => shorten(t, 80)).join("; ")}`);
    }

    if (excerpts.length > 0) {
      lines.push("  excerpts:");
      for (const ex of excerpts) {
        const time =
          typeof ex.startTime === "number" ? `[${ex.startTime.toFixed(1)}s] ` : "";
        lines.push(`    - "${time}${shorten(ex.text, 280)}"`);
      }
    }
    lines.push("");
  }

  lines.push("</evidence>", "", `Question: ${question}`);
  return lines.join("\n");
}
