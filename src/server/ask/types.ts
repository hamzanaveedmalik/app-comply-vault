/**
 * Ask ComplyVault — type definitions (CV-FEAT-014)
 *
 * Phase 1 retrieval mode is "keyword" — Phase 2 will add "hybrid" and "semantic".
 */

import { z } from "zod";

export const AskRequestSchema = z.object({
  question: z.string().trim().min(3).max(500),
  meetingId: z.string().cuid().optional(),
  windowDays: z.number().int().positive().max(365).optional(),
});

export type AskRequest = z.infer<typeof AskRequestSchema>;

export type RetrievalMode = "keyword" | "hybrid" | "semantic";

export type Citation = {
  meetingId: string;
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
};

export type AskOutcome =
  | {
      kind: "answer";
      answer: string;
      citations: Citation[];
      retrieval: RetrievalMeta;
      model: string;
      latencyMs: number;
    }
  | {
      kind: "no-evidence";
      reason: "no-meetings" | "no-matches";
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
    retrieval: RetrievalMeta;
    model: string;
    latencyMs: number;
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
  clientName: string;
  meetingDate: Date;
  meetingType: string;
  transcript: unknown;
  extraction: unknown;
  searchableText: string | null;
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
