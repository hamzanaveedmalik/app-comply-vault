/**
 * Ask ComplyVault — retrieval pipeline (Phase 1, PRD §5.3).
 *
 * 1. Query `Meeting.searchableText` for any keyword hit, scoped to the
 *    user's workspace (HARD compliance boundary — see PRD §6.1).
 * 2. Score by (keyword-match count) × (recency decay).
 * 3. Keep top-K, extract up to 3 best transcript segments per meeting.
 * 4. Cap total context size to keep prompts cheap.
 *
 * Phase 2 will add semantic retrieval (pgvector) — until then this
 * substring approach is good enough for the launch corpus.
 */

import type {
  RetrievalCandidate,
  ScoredEvidence,
  RetrievalMode,
} from "./types";
import { topicToString, type TopicEntry } from "~/lib/topics";

const MAX_CANDIDATES = 12;
const MAX_KEEP = 5;
const MAX_EXCERPTS_PER_MEETING = 3;
const MAX_EXCERPT_CHARS = 280;
// Hard cap on the assembled evidence block. Each meeting easily fits in
// ~1.5KB after excerpting, so 5 meetings × ~1.5KB stays well under the
// 12KB / ~3K token target from PRD §5.3.
export const MAX_CONTEXT_CHARS = 12_000;

type ExtractionShape = {
  topics?: Array<TopicEntry>;
  recommendations?: Array<{ text?: string; startTime?: number; endTime?: number }>;
  disclosures?: Array<{ text?: string; startTime?: number; endTime?: number }>;
  decisions?: Array<{ text?: string; startTime?: number; endTime?: number }>;
  followUps?: Array<{ text?: string; startTime?: number; endTime?: number }>;
};

type TranscriptShape = {
  segments?: Array<{
    text?: string;
    startTime?: number;
    endTime?: number;
  }>;
};

export const RETRIEVAL_MODE: RetrievalMode = "keyword";

/**
 * Count how many of the keywords appear (case-insensitive) in a haystack.
 * Each keyword contributes at most 1 to the count, regardless of how many
 * times it appears — this prevents one chatty meeting from dominating
 * purely because a single common term repeats.
 */
function keywordMatchCount(haystack: string, keywords: string[]): number {
  if (!haystack || keywords.length === 0) return 0;
  const lower = haystack.toLowerCase();
  let n = 0;
  for (const kw of keywords) {
    if (lower.includes(kw)) n++;
  }
  return n;
}

/**
 * Recency decay: meetings older than ~6 months get linearly less weight.
 * Floor at 0.25 so older-but-very-relevant meetings still surface.
 */
function recencyDecay(meetingDate: Date, now: Date): number {
  const ageDays = Math.max(
    0,
    (now.getTime() - meetingDate.getTime()) / (1000 * 60 * 60 * 24)
  );
  // Half-life ~180 days, exponential decay, floored at 0.25.
  const decay = Math.exp(-ageDays / 180);
  return Math.max(decay, 0.25);
}

/**
 * Score a single candidate against the question keywords.
 */
function scoreCandidate(
  candidate: RetrievalCandidate,
  keywords: string[],
  now: Date
): number {
  const haystack = candidate.searchableText ?? "";
  const matches = keywordMatchCount(haystack, keywords);
  if (matches === 0) return 0;
  return matches * recencyDecay(candidate.meetingDate, now);
}

/**
 * Pick the most informative transcript segments + matching extraction
 * fields for a meeting. We never emit a meeting's full transcript — only
 * the parts that actually overlap with the question keywords.
 */
function extractExcerpts(
  candidate: RetrievalCandidate,
  keywords: string[]
): { excerpts: Array<{ text: string; startTime?: number; endTime?: number }>; matchedFields: string[] } {
  const matchedFields: string[] = [];
  const candidates: Array<{
    text: string;
    startTime?: number;
    endTime?: number;
    score: number;
    source: "transcript" | "field";
  }> = [];

  // Transcript segments
  const transcript = (candidate.transcript ?? {}) as TranscriptShape;
  if (Array.isArray(transcript.segments)) {
    for (const seg of transcript.segments) {
      if (!seg?.text) continue;
      const score = keywordMatchCount(seg.text, keywords);
      if (score === 0) continue;
      candidates.push({
        text: seg.text,
        startTime: typeof seg.startTime === "number" ? seg.startTime : undefined,
        endTime: typeof seg.endTime === "number" ? seg.endTime : undefined,
        score,
        source: "transcript",
      });
    }
  }

  // Extraction fields. Topics fold into a single "topics:" line at the prompt
  // builder, so here we surface the per-item text (recommendations, etc.).
  const extraction = (candidate.extraction ?? {}) as ExtractionShape;
  const fieldGroups: Array<[
    string,
    Array<{ text?: string; startTime?: number; endTime?: number }> | undefined,
  ]> = [
    ["recommendation", extraction.recommendations],
    ["disclosure", extraction.disclosures],
    ["decision", extraction.decisions],
    ["followUp", extraction.followUps],
  ];
  for (const [label, items] of fieldGroups) {
    if (!Array.isArray(items)) continue;
    for (const item of items) {
      const text = item?.text;
      if (!text) continue;
      const score = keywordMatchCount(text, keywords);
      if (score === 0) continue;
      matchedFields.push(label);
      candidates.push({
        text,
        startTime: typeof item.startTime === "number" ? item.startTime : undefined,
        endTime: typeof item.endTime === "number" ? item.endTime : undefined,
        score,
        source: "field",
      });
    }
  }

  // Also check topics for matches (these don't have timestamps but are great
  // grounding signals).
  if (Array.isArray(extraction.topics)) {
    for (const topic of extraction.topics) {
      const topicText = topicToString(topic);
      if (!topicText) continue;
      const score = keywordMatchCount(topicText, keywords);
      if (score === 0) continue;
      matchedFields.push("topic");
      candidates.push({
        text: topicText,
        score,
        source: "field",
      });
    }
  }

  // Sort by score desc, then prefer transcript segments (more grounded), then
  // by recency in transcript (lower startTime first when scores tie).
  candidates.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.source !== b.source) return a.source === "transcript" ? -1 : 1;
    const aStart = a.startTime ?? Number.POSITIVE_INFINITY;
    const bStart = b.startTime ?? Number.POSITIVE_INFINITY;
    return aStart - bStart;
  });

  const seen = new Set<string>();
  const picked: Array<{ text: string; startTime?: number; endTime?: number }> = [];
  for (const c of candidates) {
    if (picked.length >= MAX_EXCERPTS_PER_MEETING) break;
    // Truncate & dedupe by first 80 chars so near-duplicate segments don't
    // both burn an excerpt slot.
    const dedupeKey = c.text.replace(/\s+/g, " ").trim().slice(0, 80).toLowerCase();
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    const text =
      c.text.length > MAX_EXCERPT_CHARS
        ? c.text.slice(0, MAX_EXCERPT_CHARS - 1).trimEnd() + "…"
        : c.text;
    picked.push({
      text,
      startTime: c.startTime,
      endTime: c.endTime,
    });
  }

  // Dedupe matched fields and keep stable order.
  const uniqueMatched: string[] = [];
  const fieldSeen = new Set<string>();
  for (const f of matchedFields) {
    if (fieldSeen.has(f)) continue;
    fieldSeen.add(f);
    uniqueMatched.push(f);
  }

  return { excerpts: picked, matchedFields: uniqueMatched };
}

/**
 * Score every candidate, keep the top-K, attach excerpts, enforce the
 * context size cap.
 */
export function rankAndExcerpt(
  candidates: RetrievalCandidate[],
  keywords: string[],
  now: Date = new Date()
): ScoredEvidence[] {
  const scored: ScoredEvidence[] = [];
  for (const candidate of candidates) {
    const score = scoreCandidate(candidate, keywords, now);
    if (score <= 0) continue;
    const { excerpts, matchedFields } = extractExcerpts(candidate, keywords);
    // A candidate matched searchableText but yielded no extractable
    // excerpt: surface the searchableText window so the LLM still has
    // something concrete to ground on.
    const fallbackExcerpts = excerpts.length > 0
      ? excerpts
      : buildFallbackExcerpts(candidate, keywords);
    scored.push({
      candidate,
      score,
      excerpts: fallbackExcerpts,
      matchedFields,
    });
  }

  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, MAX_KEEP);

  // Enforce a hard context-size cap. Drop the lowest-scoring meetings
  // until we fit, but always keep at least the top-scored one.
  let totalChars = 0;
  const kept: ScoredEvidence[] = [];
  for (const item of top) {
    const blockSize = estimateEvidenceSize(item);
    if (kept.length > 0 && totalChars + blockSize > MAX_CONTEXT_CHARS) break;
    kept.push(item);
    totalChars += blockSize;
  }
  return kept;
}

function buildFallbackExcerpts(
  candidate: RetrievalCandidate,
  keywords: string[]
): Array<{ text: string; startTime?: number; endTime?: number }> {
  const haystack = candidate.searchableText;
  if (!haystack) return [];
  const lower = haystack.toLowerCase();
  for (const kw of keywords) {
    const idx = lower.indexOf(kw);
    if (idx >= 0) {
      const start = Math.max(0, idx - 60);
      const end = Math.min(haystack.length, idx + 200);
      const window = haystack.slice(start, end).replace(/\s+/g, " ").trim();
      return [{ text: window }];
    }
  }
  return [];
}

function estimateEvidenceSize(item: ScoredEvidence): number {
  let n = 200; // header + topics line
  for (const ex of item.excerpts) {
    n += ex.text.length + 20;
  }
  return n;
}

export const RETRIEVAL_LIMITS = {
  candidateLimit: MAX_CANDIDATES,
  keepLimit: MAX_KEEP,
  excerptsPerMeeting: MAX_EXCERPTS_PER_MEETING,
  maxExcerptChars: MAX_EXCERPT_CHARS,
  maxContextChars: MAX_CONTEXT_CHARS,
} as const;
