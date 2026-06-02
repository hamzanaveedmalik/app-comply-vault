/**
 * POST /api/ask — Ask ComplyVault (CV-FEAT-014, Phase 1).
 *
 * Auth: `requireAppAccess()` — same guard as every other app route.
 * Tenancy: workspaceId is taken from the session, NEVER trusted from the
 *          client body.
 *
 * Response shape: see `AskResponse` in `src/server/ask/types.ts` and
 * PRD §5.2 for the exact contract.
 */

import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { requireAppAccess } from "~/server/auth/guards";
import { withPerformance } from "~/server/performance";
import { askComplyVault } from "~/server/ask";
import {
  AskRequestSchema,
  type AskResponse,
} from "~/server/ask/types";
import {
  NO_EVIDENCE_ANSWER,
  BLOCKED_REGULATORY_ANSWER,
} from "~/server/ask/prompt";
import { checkRateLimit } from "~/server/ask/rate-limit";

export const POST = withPerformance(
  "Ask ComplyVault",
  async function POST(request: Request): Promise<NextResponse<AskResponse>> {
    const access = await requireAppAccess();
    if (!access.ok) {
      return NextResponse.json<AskResponse>(
        {
          success: false,
          error: "LLM_PROVIDER_ERROR",
          message: access.error,
        },
        { status: access.status }
      );
    }
    const { workspaceId, session } = access;
    const userId = session.user.id;

    // Per-user, per-workspace soft cap (PRD §3.1, §7).
    const limiter = checkRateLimit(workspaceId, userId);
    if (!limiter.allowed) {
      return NextResponse.json<AskResponse>(
        {
          success: false,
          error: "RATE_LIMITED",
          retryAfterSec: limiter.retryAfterSec,
        },
        {
          status: 429,
          headers: { "Retry-After": String(limiter.retryAfterSec) },
        }
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json<AskResponse>(
        {
          success: false,
          error: "VALIDATION_ERROR",
          issues: [],
        },
        { status: 400 }
      );
    }

    let parsed;
    try {
      parsed = AskRequestSchema.parse(body);
    } catch (err) {
      if (err instanceof ZodError) {
        return NextResponse.json<AskResponse>(
          {
            success: false,
            error: "VALIDATION_ERROR",
            issues: err.issues,
          },
          { status: 400 }
        );
      }
      throw err;
    }

    const outcome = await askComplyVault({
      question: parsed.question,
      workspaceId,
      userId,
      ...(parsed.meetingId ? { meetingId: parsed.meetingId } : {}),
      ...(parsed.windowDays ? { windowDays: parsed.windowDays } : {}),
    });

    switch (outcome.kind) {
      case "answer":
        return NextResponse.json<AskResponse>({
          success: true,
          data: {
            answer: outcome.answer,
            citations: outcome.citations,
            retrieval: outcome.retrieval,
            model: outcome.model,
            latencyMs: outcome.latencyMs,
          },
        });

      case "no-evidence":
        return NextResponse.json<AskResponse>({
          success: true,
          data: {
            answer: NO_EVIDENCE_ANSWER,
            citations: [],
            retrieval: outcome.retrieval,
            model: outcome.model,
            latencyMs: outcome.latencyMs,
          },
        });

      case "blocked":
        // Treat blocked output as a successful (envelope) response with a
        // pre-approved string — the user gets a clear instruction to
        // rephrase. The incident is already audited inside the
        // orchestrator with `outputBlocked: true`.
        return NextResponse.json<AskResponse>({
          success: true,
          data: {
            answer: BLOCKED_REGULATORY_ANSWER,
            citations: [],
            retrieval: outcome.retrieval,
            model: outcome.model,
            latencyMs: outcome.latencyMs,
          },
        });

      case "provider-error":
        return NextResponse.json<AskResponse>(
          {
            success: false,
            error: "LLM_PROVIDER_ERROR",
            // Generic message — never echo back evidence or the question
            // (PRD §6.4 scrubbing rule).
            message: "Couldn't generate an answer right now.",
          },
          { status: 502 }
        );
    }
  }
);
