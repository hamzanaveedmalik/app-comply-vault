/**
 * Ask ComplyVault — orchestrator (CV-FEAT-014, Phase 1).
 *
 * Pipeline:
 *   1. Extract keywords from the question.
 *   2. Query `Meeting.searchableText` scoped to the user's workspace
 *      (HARD compliance boundary — PRD §6.1).
 *   3. Rank + excerpt → evidence block.
 *   4. If no evidence: short-circuit with NO_EVIDENCE_ANSWER (no LLM call,
 *      saves cost — PRD §7).
 *   5. Call LLM with locked system prompt.
 *   6. Post-filter the answer for banned regulatory citations (PRD §6.2).
 *   7. Write an append-only audit event (questionHash only — never the
 *      raw question or any client name — PRD §6.4).
 *
 * All compliance guarantees live in this file. Tests in `index.test.ts`
 * pin them in place.
 */

import crypto from "node:crypto";

import type { db as defaultDb } from "~/server/db";
import { extractKeywords } from "./keywords";
import {
  rankAndExcerpt,
  RETRIEVAL_MODE,
  RETRIEVAL_LIMITS,
} from "./retrieval";
import {
  SYSTEM_PROMPT,
  NO_EVIDENCE_ANSWER,
  BLOCKED_REGULATORY_ANSWER,
  buildUserMessage,
} from "./prompt";
import { scanForRegulatoryCitations } from "./regulatory-guard";
import { defaultAskCompletion, resolveAskModel, type AskCompletionFn } from "./provider";
import type {
  AskOutcome,
  Citation,
  RetrievalCandidate,
  RetrievalMeta,
  ScoredEvidence,
} from "./types";

type PrismaLike = {
  meeting: {
    findMany: (args: {
      where: Record<string, unknown>;
      select: Record<string, true>;
      take: number;
      orderBy: Array<Record<string, "asc" | "desc">>;
    }) => Promise<RetrievalCandidate[]>;
  };
  auditEvent: {
    create: (args: {
      data: {
        workspaceId: string;
        userId: string;
        action: "AI_QUERY";
        resourceType: string;
        resourceId: string;
        metadata: Record<string, unknown>;
      };
    }) => Promise<unknown>;
  };
};

export type AskInput = {
  question: string;
  workspaceId: string;
  userId: string;
  meetingId?: string;
  windowDays?: number;
};

export type AskDependencies = {
  prisma?: PrismaLike;
  completion?: AskCompletionFn;
  model?: string;
  now?: () => Date;
};

/**
 * SHA-256 hash of the raw question, truncated to 16 hex chars.
 * Operators can correlate by hash if a user reports a bad answer; the
 * audit log never contains the question text itself (PRD §6.4).
 */
export function hashQuestion(question: string): string {
  return crypto
    .createHash("sha256")
    .update(question.trim().toLowerCase())
    .digest("hex")
    .slice(0, 16);
}

export async function askComplyVault(
  input: AskInput,
  deps: AskDependencies = {}
): Promise<AskOutcome> {
  const prisma = deps.prisma ?? ((await getDefaultDb()) as unknown as PrismaLike);
  const completion = deps.completion ?? defaultAskCompletion;
  const model = deps.model ?? resolveAskModel();
  const now = deps.now ? deps.now() : new Date();
  const startedAt = Date.now();

  const keywords = extractKeywords(input.question);

  // Build the Prisma where clause. Workspace boundary is non-negotiable —
  // every branch below MUST include workspaceId from the caller's session.
  const where: Record<string, unknown> = {
    workspaceId: input.workspaceId,
    // PRD §6.3 — only finalised / draft-ready meetings are queryable.
    status: { in: ["DRAFT_READY", "FINALIZED"] },
  };
  if (input.meetingId) {
    where.id = input.meetingId;
  }
  if (input.windowDays) {
    const cutoff = new Date(now.getTime() - input.windowDays * 24 * 60 * 60 * 1000);
    where.meetingDate = { gte: cutoff };
  }
  if (keywords.length > 0) {
    where.OR = keywords.map((kw) => ({
      searchableText: { contains: kw, mode: "insensitive" },
    }));
  }

  let candidates: RetrievalCandidate[] = [];
  try {
    candidates = await prisma.meeting.findMany({
      where,
      select: {
        id: true,
        clientName: true,
        meetingDate: true,
        meetingType: true,
        transcript: true,
        extraction: true,
        searchableText: true,
      },
      take: RETRIEVAL_LIMITS.candidateLimit,
      orderBy: [{ meetingDate: "desc" }],
    });
  } catch (err) {
    // Retrieval failures are operational, not user-facing — but we still
    // need to log an audit event so an operator can correlate.
    await safeAudit(prisma, {
      workspaceId: input.workspaceId,
      userId: input.userId,
      questionHash: hashQuestion(input.question),
      questionLength: input.question.length,
      retrievedMeetingIds: [],
      candidatesScanned: 0,
      candidatesUsed: 0,
      model,
      latencyMs: Date.now() - startedAt,
      mode: RETRIEVAL_MODE,
      error: "RETRIEVAL_ERROR",
      ...(input.meetingId ? { scopedToMeetingId: input.meetingId } : {}),
      ...(input.windowDays ? { windowDays: input.windowDays } : {}),
    });
    const errMessage = err instanceof Error ? err.message : "Retrieval failed";
    return {
      kind: "provider-error",
      message: errMessage,
      retrieval: { candidatesScanned: 0, candidatesUsed: 0, mode: RETRIEVAL_MODE },
      model,
      latencyMs: Date.now() - startedAt,
    };
  }

  const candidatesScanned = candidates.length;

  // Enforce the workspace boundary defensively, even though the where
  // clause already filters. Belt-and-braces: a future refactor that
  // accidentally widens the query won't slip past this check.
  const safeCandidates = candidates.filter(
    (c) =>
      // The select doesn't include workspaceId, but if a future change
      // adds it we want this filter to catch a mismatch.
      !("workspaceId" in c) ||
      (c as RetrievalCandidate & { workspaceId?: string }).workspaceId ===
        input.workspaceId
  );

  const evidence = rankAndExcerpt(safeCandidates, keywords, now);
  const retrieval: RetrievalMeta = {
    candidatesScanned,
    candidatesUsed: evidence.length,
    mode: RETRIEVAL_MODE,
  };

  if (evidence.length === 0) {
    await safeAudit(prisma, {
      workspaceId: input.workspaceId,
      userId: input.userId,
      questionHash: hashQuestion(input.question),
      questionLength: input.question.length,
      retrievedMeetingIds: [],
      candidatesScanned,
      candidatesUsed: 0,
      model,
      latencyMs: Date.now() - startedAt,
      mode: RETRIEVAL_MODE,
      outcome: "no_evidence",
      ...(input.meetingId ? { scopedToMeetingId: input.meetingId } : {}),
      ...(input.windowDays ? { windowDays: input.windowDays } : {}),
    });
    return {
      kind: "no-evidence",
      reason: candidatesScanned === 0 ? "no-meetings" : "no-matches",
      retrieval,
      model,
      latencyMs: Date.now() - startedAt,
    };
  }

  let rawAnswer: string;
  try {
    rawAnswer = await completion({
      systemPrompt: SYSTEM_PROMPT,
      userMessage: buildUserMessage(input.question, evidence),
      model,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "LLM provider error";
    await safeAudit(prisma, {
      workspaceId: input.workspaceId,
      userId: input.userId,
      questionHash: hashQuestion(input.question),
      questionLength: input.question.length,
      retrievedMeetingIds: evidence.map((e) => e.candidate.id),
      candidatesScanned,
      candidatesUsed: evidence.length,
      model,
      latencyMs: Date.now() - startedAt,
      mode: RETRIEVAL_MODE,
      error: "LLM_PROVIDER_ERROR",
      ...(input.meetingId ? { scopedToMeetingId: input.meetingId } : {}),
      ...(input.windowDays ? { windowDays: input.windowDays } : {}),
    });
    return {
      kind: "provider-error",
      message,
      retrieval,
      model,
      latencyMs: Date.now() - startedAt,
    };
  }

  // Defence in depth: even though the system prompt forbids regulatory
  // citations, scan the output for them and block on a hit.
  const scan = scanForRegulatoryCitations(rawAnswer);
  if (scan.blocked) {
    await safeAudit(prisma, {
      workspaceId: input.workspaceId,
      userId: input.userId,
      questionHash: hashQuestion(input.question),
      questionLength: input.question.length,
      retrievedMeetingIds: evidence.map((e) => e.candidate.id),
      candidatesScanned,
      candidatesUsed: evidence.length,
      model,
      latencyMs: Date.now() - startedAt,
      mode: RETRIEVAL_MODE,
      outputBlocked: true,
      blockedPattern: scan.matchedPattern,
      ...(input.meetingId ? { scopedToMeetingId: input.meetingId } : {}),
      ...(input.windowDays ? { windowDays: input.windowDays } : {}),
    });
    return {
      kind: "blocked",
      reason: "regulatory_citation",
      retrieval,
      model,
      latencyMs: Date.now() - startedAt,
    };
  }

  const citations = buildCitations(evidence);

  await safeAudit(prisma, {
    workspaceId: input.workspaceId,
    userId: input.userId,
    questionHash: hashQuestion(input.question),
    questionLength: input.question.length,
    retrievedMeetingIds: citations.map((c) => c.meetingId),
    candidatesScanned,
    candidatesUsed: evidence.length,
    model,
    latencyMs: Date.now() - startedAt,
    mode: RETRIEVAL_MODE,
    outcome: "answered",
    ...(input.meetingId ? { scopedToMeetingId: input.meetingId } : {}),
    ...(input.windowDays ? { windowDays: input.windowDays } : {}),
  });

  return {
    kind: "answer",
    answer: rawAnswer,
    citations,
    retrieval,
    model,
    latencyMs: Date.now() - startedAt,
  };
}

/**
 * Build the citation list from the evidence we actually shipped to the
 * LLM. Critical: citations are STRUCTURAL — extracted from the evidence
 * block, not parsed out of the model's prose. This prevents a
 * hallucinated meeting reference from leaking through into the UI.
 */
function buildCitations(evidence: ScoredEvidence[]): Citation[] {
  return evidence.map((item) => {
    const firstExcerpt = item.excerpts[0];
    const snippetSource = firstExcerpt?.text ?? "";
    const snippet = snippetSource.length > 240
      ? snippetSource.slice(0, 239).trimEnd() + "…"
      : snippetSource;
    return {
      meetingId: item.candidate.id,
      clientName: item.candidate.clientName,
      meetingDate: item.candidate.meetingDate.toISOString(),
      meetingType: item.candidate.meetingType,
      snippet,
      ...(firstExcerpt?.startTime !== undefined
        ? { transcriptStartSec: firstExcerpt.startTime }
        : {}),
    };
  });
}

/**
 * Audit writes are best-effort: if the DB hiccups we still want to
 * return the user's answer. Failures are logged with a generic scrubbed
 * message — never the raw question.
 */
async function safeAudit(
  prisma: PrismaLike,
  metadata: Record<string, unknown> & {
    workspaceId: string;
    userId: string;
  }
): Promise<void> {
  try {
    await prisma.auditEvent.create({
      data: {
        workspaceId: metadata.workspaceId,
        userId: metadata.userId,
        action: "AI_QUERY",
        resourceType: "workspace",
        resourceId: metadata.workspaceId,
        metadata,
      },
    });
  } catch (err) {
    // Scrub: never log the raw question, evidence, or client names — the
    // metadata object already only contains hashes/ids/counts per PRD
    // §6.4, but we log only the error class here to stay extra safe.
    const errName = err instanceof Error ? err.name : "UnknownError";
    console.warn(`[ask] audit log write failed (${errName})`);
  }
}

/**
 * Lazy default-db import so unit tests can construct the orchestrator
 * without pulling in `@prisma/client`.
 */
async function getDefaultDb(): Promise<typeof defaultDb> {
  const mod = await import("~/server/db");
  return mod.db;
}

export { SYSTEM_PROMPT, NO_EVIDENCE_ANSWER, BLOCKED_REGULATORY_ANSWER };
export { RETRIEVAL_LIMITS, RETRIEVAL_MODE };
