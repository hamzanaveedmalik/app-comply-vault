/**
 * Ask ComplyVault — type definitions (CV-FEAT-014)
 *
 * Phase 1 retrieval mode is "keyword" — Phase 2 will add "hybrid" and "semantic".
 * Email Intelligence Phase 3 extends candidates/citations to EMAIL sources.
 * Release 1: provenance labels, honest-miss, population completeness (CV-AX-00/01/06).
 */

import { z } from "zod";
import type { ProvenancedElement } from "./provenance";
import type { HonestMissOutcome, IndexCoverageManifest } from "./coverage";

export const AskRequestSchema = z.object({
  question: z.string().trim().min(3).max(500),
  meetingId: z.string().cuid().optional(),
  windowDays: z.number().int().positive().max(365).optional(),
});

export type AskRequest = z.infer<typeof AskRequestSchema>;

export type RetrievalMode = "keyword" | "hybrid" | "semantic";

export type CitationSourceType = "MEETING" | "EMAIL";

export type Citation = {
  sourceType: CitationSourceType;
  /** Meeting id for MEETING; thread id for EMAIL (deep-link target). */
  meetingId: string;
  threadId?: string;
  messageId?: string;
  contentSha256?: string;
  clientName: string;
  meetingDate: string;
  meetingType: string;
  snippet: string;
  transcriptStartSec?: number;
};

export type RetrievalMeta = {
  candidatesScanned: number;
  candidatesUsed: number;
  mode: RetrievalMode;
  /** CV-AX-01: complete population vs ranked sample under stated filters. */
  populationCompleteness?: "complete_population" | "ranked_sample";
  populationStatement?: string;
};

export type AskOutcome =
  | {
      kind: "answer";
      answer: string;
      citations: Citation[];
      elements: ProvenancedElement[];
      retrieval: RetrievalMeta;
      model: string;
      latencyMs: number;
    }
  | {
      kind: "honest-miss";
      missReason: HonestMissOutcome["missReason"];
      message: string;
      missing: string;
      coveredRanges: IndexCoverageManifest["sources"];
      retrieval: RetrievalMeta;
      model: string;
      latencyMs: number;
    }
  | {
      kind: "no-evidence";
      reason: "no-meetings" | "no-matches" | "no-correspondence";
      retrieval: RetrievalMeta;
      model: string;
      latencyMs: number;
    }
  | {
      kind: "blocked";
      reason: "regulatory_citation";
      retrieval: RetrievalMeta;
      model: string;
      latencyMs: number;
    }
  | {
      kind: "provider-error";
      message: string;
      retrieval: RetrievalMeta;
      model: string;
      latencyMs: number;
    };

export type AskResponseSuccess = {
  success: true;
  data: {
    answer: string;
    citations: Citation[];
    elements?: ProvenancedElement[];
    retrieval: RetrievalMeta;
    model: string;
    latencyMs: number;
    kind?: "answer" | "honest-miss";
    missReason?: HonestMissOutcome["missReason"];
    missing?: string;
    coveredRanges?: IndexCoverageManifest["sources"];
  };
};

export type AskResponseError =
  | {
      success: false;
      error: "RATE_LIMITED";
      retryAfterSec: number;
    }
  | {
      success: false;
      error: "LLM_PROVIDER_ERROR";
      message: string;
    }
  | {
      success: false;
      error: "VALIDATION_ERROR";
      issues: z.ZodIssue[];
    };

export type AskResponse = AskResponseSuccess | AskResponseError;

/**
 * Internal retrieval candidate shape. Decoupled from the Prisma row so the
 * orchestrator can be tested against an in-memory store.
 */
export type RetrievalCandidate = {
  id: string;
  sourceType: CitationSourceType;
  clientName: string;
  meetingDate: Date;
  meetingType: string;
  transcript: unknown;
  extraction: unknown;
  searchableText: string | null;
  /** EMAIL only */
  threadId?: string;
  messageId?: string;
  contentSha256?: string;
  direction?: string;
};

/**
 * Scored + excerpted candidate used to build the evidence block.
 */
export type ScoredEvidence = {
  candidate: RetrievalCandidate;
  score: number;
  excerpts: Array<{
    text: string;
    startTime?: number;
    endTime?: number;
  }>;
  matchedFields: string[];
};
