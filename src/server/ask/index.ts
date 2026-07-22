/**
 * Ask ComplyVault — orchestrator (CV-FEAT-014, Phase 1 + Email Intelligence Phase 3).
 *
 * Pipeline:
 *   1. Extract keywords from the question.
 *   2. Query Meeting.searchableText + (when enabled) EvidenceItem.searchableText
 *      scoped to the user's workspace (HARD compliance boundary — PRD §6.1).
 *   3. Rank + excerpt → evidence block.
 *   4. If no evidence: short-circuit (no LLM call).
 *   5. Call LLM with locked system prompt.
 *   6. Post-filter the answer for banned regulatory citations (PRD §6.2).
 *   7. Write an append-only audit event (questionHash only — PRD §6.4).
 */

import crypto from "node:crypto";

import type { db as defaultDb } from "~/server/db";
import {
  isAskHybridRetrievalEnabled,
  isEmailIntelligenceEnabled,
} from "~/lib/feature-flags";
import { extractKeywords } from "./keywords";
import {
  getActiveRetrievalMode,
  rankAndExcerpt,
  rankAndExcerptHybrid,
  RETRIEVAL_LIMITS,
  RETRIEVAL_MODE,
} from "./retrieval";
import { embedTexts, searchSimilarChunks } from "./embeddings";
import {
  SYSTEM_PROMPT,
  NO_EVIDENCE_ANSWER,
  NO_CORRESPONDENCE_ANSWER,
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

type MeetingRow = {
  id: string;
  clientName: string;
  meetingDate: Date;
  meetingType: string;
  transcript: unknown;
  extraction: unknown;
  searchableText: string | null;
};

type EmailEvidenceRow = {
  id: string;
  title: string;
  occurredAt: Date;
  contentSha256: string;
  searchableText: string | null;
  client: { name: string } | null;
  communication: {
    id: string;
    threadId: string;
    direction: string;
  } | null;
};

type PrismaLike = {
  meeting: {
    findMany: (args: {
      where: Record<string, unknown>;
      select: Record<string, true>;
      take: number;
      orderBy: Array<Record<string, "asc" | "desc">>;
    }) => Promise<MeetingRow[]>;
  };
  evidenceItem?: {
    findMany: (args: {
      where: Record<string, unknown>;
      select: Record<string, unknown>;
      take: number;
      orderBy: Array<Record<string, "asc" | "desc">>;
    }) => Promise<EmailEvidenceRow[]>;
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
  emailIntelligenceEnabled?: boolean;
  hybridRetrievalEnabled?: boolean;
};

/**
 * SHA-256 hash of the raw question, truncated to 16 hex chars.
 */
export function hashQuestion(question: string): string {
  return crypto
    .createHash("sha256")
    .update(question.trim().toLowerCase())
    .digest("hex")
    .slice(0, 16);
}

function meetingToCandidate(row: MeetingRow): RetrievalCandidate {
  return {
    id: row.id,
    sourceType: "MEETING",
    clientName: row.clientName,
    meetingDate: row.meetingDate,
    meetingType: row.meetingType,
    transcript: row.transcript,
    extraction: row.extraction,
    searchableText: row.searchableText,
  };
}

function emailToCandidate(row: EmailEvidenceRow): RetrievalCandidate | null {
  if (!row.communication) return null;
  return {
    id: row.id,
    sourceType: "EMAIL",
    clientName: row.client?.name ?? "Unknown client",
    meetingDate: row.occurredAt,
    meetingType: "Email",
    transcript: null,
    extraction: null,
    searchableText: row.searchableText,
    threadId: row.communication.threadId,
    messageId: row.communication.id,
    contentSha256: row.contentSha256,
    direction: row.communication.direction,
  };
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
  const emailIntel =
    deps.emailIntelligenceEnabled ?? isEmailIntelligenceEnabled();
  const hybridEnabled =
    deps.hybridRetrievalEnabled ?? isAskHybridRetrievalEnabled();
  const retrievalMode = getActiveRetrievalMode(hybridEnabled);

  const keywords = extractKeywords(input.question);

  const where: Record<string, unknown> = {
    workspaceId: input.workspaceId,
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

  let meetingRows: MeetingRow[] = [];
  try {
    meetingRows = await prisma.meeting.findMany({
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
    await safeAudit(prisma, {
      workspaceId: input.workspaceId,
      userId: input.userId,
      questionHash: hashQuestion(input.question),
      questionLength: input.question.length,
      retrievedMeetingIds: [],
      retrievedEmailIds: [],
      candidatesScanned: 0,
      candidatesUsed: 0,
      model,
      latencyMs: Date.now() - startedAt,
      mode: retrievalMode,
      error: "RETRIEVAL_ERROR",
      ...(input.meetingId ? { scopedToMeetingId: input.meetingId } : {}),
      ...(input.windowDays ? { windowDays: input.windowDays } : {}),
    });
    const errMessage = err instanceof Error ? err.message : "Retrieval failed";
    return {
      kind: "provider-error",
      message: errMessage,
      retrieval: { candidatesScanned: 0, candidatesUsed: 0, mode: retrievalMode },
      model,
      latencyMs: Date.now() - startedAt,
    };
  }

  const candidates: RetrievalCandidate[] = meetingRows.map(meetingToCandidate);

  if (emailIntel && !input.meetingId && prisma.evidenceItem) {
    const emailWhere: Record<string, unknown> = {
      workspaceId: input.workspaceId,
      sourceType: "EMAIL",
      deletedAt: null,
      searchableText: { not: null },
    };
    if (input.windowDays) {
      const cutoff = new Date(now.getTime() - input.windowDays * 24 * 60 * 60 * 1000);
      emailWhere.occurredAt = { gte: cutoff };
    }
    if (keywords.length > 0) {
      emailWhere.OR = keywords.map((kw) => ({
        searchableText: { contains: kw, mode: "insensitive" },
      }));
    }

    try {
      const emailRows = await prisma.evidenceItem.findMany({
        where: emailWhere,
        select: {
          id: true,
          title: true,
          occurredAt: true,
          contentSha256: true,
          searchableText: true,
          client: { select: { name: true } },
          communication: {
            select: { id: true, threadId: true, direction: true },
          },
        },
        take: RETRIEVAL_LIMITS.candidateLimit,
        orderBy: [{ occurredAt: "desc" }],
      });
      for (const row of emailRows) {
        const c = emailToCandidate(row);
        if (c) candidates.push(c);
      }
    } catch {
      // Email retrieval is additive; meeting-only answers still work.
    }
  }

  const cosineByCandidateId = new Map<string, number>();
  if (hybridEnabled && input.question.trim().length > 0) {
    try {
      const [queryEmbedding] = await embedTexts([input.question]);
      if (queryEmbedding) {
        const hits = await searchSimilarChunks({
          workspaceId: input.workspaceId,
          queryEmbedding,
          limit: RETRIEVAL_LIMITS.candidateLimit,
        });
        for (const hit of hits) {
          const prev = cosineByCandidateId.get(hit.sourceId) ?? 0;
          if (hit.cosineSimilarity > prev) {
            cosineByCandidateId.set(hit.sourceId, hit.cosineSimilarity);
          }
        }
        // Expand candidate set with semantic hits not already present.
        const have = new Set(candidates.map((c) => c.id));
        const missingEmailIds = hits
          .filter((h) => h.sourceType === "EMAIL" && !have.has(h.sourceId))
          .map((h) => h.sourceId)
          .slice(0, 8);
        if (missingEmailIds.length > 0 && prisma.evidenceItem) {
          const extra = await prisma.evidenceItem.findMany({
            where: {
              workspaceId: input.workspaceId,
              id: { in: missingEmailIds },
              deletedAt: null,
            },
            select: {
              id: true,
              title: true,
              occurredAt: true,
              contentSha256: true,
              searchableText: true,
              client: { select: { name: true } },
              communication: {
                select: { id: true, threadId: true, direction: true },
              },
            },
            take: missingEmailIds.length,
            orderBy: [{ occurredAt: "desc" }],
          });
          for (const row of extra) {
            const c = emailToCandidate(row);
            if (c) candidates.push(c);
          }
        }
        const missingMeetingIds = hits
          .filter((h) => h.sourceType === "MEETING" && !have.has(h.sourceId))
          .map((h) => h.sourceId)
          .slice(0, 8);
        if (missingMeetingIds.length > 0) {
          const extraMeetings = await prisma.meeting.findMany({
            where: {
              workspaceId: input.workspaceId,
              id: { in: missingMeetingIds },
              status: { in: ["DRAFT_READY", "FINALIZED"] },
            },
            select: {
              id: true,
              clientName: true,
              meetingDate: true,
              meetingType: true,
              transcript: true,
              extraction: true,
              searchableText: true,
            },
            take: missingMeetingIds.length,
            orderBy: [{ meetingDate: "desc" }],
          });
          for (const row of extraMeetings) {
            candidates.push(meetingToCandidate(row));
          }
        }
      }
    } catch {
      // Hybrid is best-effort; fall back to keyword-only scoring.
    }
  }

  const candidatesScanned = candidates.length;
  const evidence =
    retrievalMode === "hybrid"
      ? rankAndExcerptHybrid(candidates, keywords, cosineByCandidateId, now)
      : rankAndExcerpt(candidates, keywords, now);
  const retrieval: RetrievalMeta = {
    candidatesScanned,
    candidatesUsed: evidence.length,
    mode: retrievalMode,
  };

  if (evidence.length === 0) {
    const reason = emailIntel
      ? candidatesScanned === 0
        ? "no-correspondence"
        : "no-matches"
      : candidatesScanned === 0
        ? "no-meetings"
        : "no-matches";
    await safeAudit(prisma, {
      workspaceId: input.workspaceId,
      userId: input.userId,
      questionHash: hashQuestion(input.question),
      questionLength: input.question.length,
      retrievedMeetingIds: [],
      retrievedEmailIds: [],
      candidatesScanned,
      candidatesUsed: 0,
      model,
      latencyMs: Date.now() - startedAt,
      mode: retrievalMode,
      outcome: "no_evidence",
      ...(input.meetingId ? { scopedToMeetingId: input.meetingId } : {}),
      ...(input.windowDays ? { windowDays: input.windowDays } : {}),
    });
    return {
      kind: "no-evidence",
      reason,
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
      retrievedMeetingIds: evidence
        .filter((e) => e.candidate.sourceType === "MEETING")
        .map((e) => e.candidate.id),
      retrievedEmailIds: evidence
        .filter((e) => e.candidate.sourceType === "EMAIL")
        .map((e) => e.candidate.id),
      candidatesScanned,
      candidatesUsed: evidence.length,
      model,
      latencyMs: Date.now() - startedAt,
      mode: retrievalMode,
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

  const scan = scanForRegulatoryCitations(rawAnswer);
  if (scan.blocked) {
    await safeAudit(prisma, {
      workspaceId: input.workspaceId,
      userId: input.userId,
      questionHash: hashQuestion(input.question),
      questionLength: input.question.length,
      retrievedMeetingIds: evidence
        .filter((e) => e.candidate.sourceType === "MEETING")
        .map((e) => e.candidate.id),
      retrievedEmailIds: evidence
        .filter((e) => e.candidate.sourceType === "EMAIL")
        .map((e) => e.candidate.id),
      candidatesScanned,
      candidatesUsed: evidence.length,
      model,
      latencyMs: Date.now() - startedAt,
      mode: retrievalMode,
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
  const answer = coerceAnswerAgainstEvidence(rawAnswer, evidence);

  await safeAudit(prisma, {
    workspaceId: input.workspaceId,
    userId: input.userId,
    questionHash: hashQuestion(input.question),
    questionLength: input.question.length,
    retrievedMeetingIds: citations
      .filter((c) => c.sourceType === "MEETING")
      .map((c) => c.meetingId),
    retrievedEmailIds: citations
      .filter((c) => c.sourceType === "EMAIL")
      .map((c) => c.messageId ?? c.meetingId),
    candidatesScanned,
    candidatesUsed: evidence.length,
    model,
    latencyMs: Date.now() - startedAt,
    mode: retrievalMode,
    outcome: "answered",
    ...(answer !== rawAnswer ? { answerCoerced: true } : {}),
    ...(input.meetingId ? { scopedToMeetingId: input.meetingId } : {}),
    ...(input.windowDays ? { windowDays: input.windowDays } : {}),
  });

  return {
    kind: "answer",
    answer,
    citations,
    retrieval,
    model,
    latencyMs: Date.now() - startedAt,
  };
}

/**
 * Belt-and-suspenders: the model sometimes emits the empty-retrieval refusal
 * even when we shipped evidence (keyword/hybrid hits). Citations are always
 * structural from retrieval, so a refusal here would contradict the UI.
 */
export function coerceAnswerAgainstEvidence(
  rawAnswer: string,
  evidence: ScoredEvidence[]
): string {
  if (evidence.length === 0) return rawAnswer;

  const trimmed = rawAnswer.trim();
  const isEmptyRefusal =
    trimmed === NO_EVIDENCE_ANSWER ||
    trimmed === NO_CORRESPONDENCE_ANSWER ||
    /no matching correspondence found/i.test(trimmed) ||
    /i don't have evidence for that/i.test(trimmed);

  if (!isEmptyRefusal) return rawAnswer;

  const top = evidence[0]!;
  const excerptRaw =
    top.excerpts[0]?.text?.trim() ||
    top.candidate.searchableText?.trim() ||
    "";
  const excerpt =
    excerptRaw.length > 160
      ? excerptRaw.slice(0, 159).trimEnd() + "…"
      : excerptRaw;
  const date = top.candidate.meetingDate.toISOString().slice(0, 10);
  const name = top.candidate.clientName;
  const quote = excerpt ? ` "${excerpt}"` : "";

  if (top.candidate.sourceType === "EMAIL") {
    return `Related email correspondence was found. On ${date} with ${name}:${quote} See the cited sources for the full thread.`;
  }
  return `Related meeting evidence was found. On ${date} with ${name}:${quote} See the cited sources.`;
}

/**
 * Citations are STRUCTURAL — extracted from evidence, not parsed from model prose.
 */
function buildCitations(evidence: ScoredEvidence[]): Citation[] {
  return evidence.map((item) => {
    const firstExcerpt = item.excerpts[0];
    const snippetSource = firstExcerpt?.text ?? "";
    const snippet =
      snippetSource.length > 240
        ? snippetSource.slice(0, 239).trimEnd() + "…"
        : snippetSource;
    const sourceType = item.candidate.sourceType ?? "MEETING";
    if (sourceType === "EMAIL") {
      const threadId = item.candidate.threadId ?? item.candidate.id;
      return {
        sourceType: "EMAIL",
        meetingId: threadId,
        threadId,
        messageId: item.candidate.messageId,
        contentSha256: item.candidate.contentSha256,
        clientName: item.candidate.clientName,
        meetingDate: item.candidate.meetingDate.toISOString(),
        meetingType: "Email",
        snippet,
      };
    }
    return {
      sourceType: "MEETING",
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
    const errName = err instanceof Error ? err.name : "UnknownError";
    console.warn(`[ask] audit log write failed (${errName})`);
  }
}

async function getDefaultDb(): Promise<typeof defaultDb> {
  const mod = await import("~/server/db");
  return mod.db;
}

export {
  SYSTEM_PROMPT,
  NO_EVIDENCE_ANSWER,
  NO_CORRESPONDENCE_ANSWER,
  BLOCKED_REGULATORY_ANSWER,
};
export { RETRIEVAL_LIMITS, RETRIEVAL_MODE };
