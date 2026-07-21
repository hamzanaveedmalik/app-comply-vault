/**
 * Persist email classification: EvidenceClassification + Flags (idempotent).
 */

import { db } from "~/server/db";
import { isEmailIntelligenceEnabled } from "~/lib/feature-flags";
import { redactForLlm } from "./redaction-guard";
import { classifyEmailWithLlm } from "./classify-email";
import {
  EMAIL_CLASSIFICATION_PROMPT_VERSION,
  emailFlagDedupeKey,
  heuristicEmailPrefilter,
  type EmailFlagType,
} from "./email-taxonomy";
import { markClassificationComplete, markClassificationFailed } from "./status";
import type { FlagSeverity, FlagType } from "../../../generated/prisma";

export type ClassifyEvidenceResult =
  | { status: "skipped"; reason: string }
  | { status: "duplicate"; classificationId: string }
  | { status: "clean"; classificationId: string }
  | { status: "flagged"; classificationId: string; flagIds: string[] }
  | { status: "error"; reason: string };

export async function classifyEmailEvidence(args: {
  workspaceId: string;
  evidenceItemId: string;
}): Promise<ClassifyEvidenceResult> {
  if (!isEmailIntelligenceEnabled()) {
    return { status: "skipped", reason: "feature_disabled" };
  }

  const item = await db.evidenceItem.findFirst({
    where: {
      id: args.evidenceItemId,
      workspaceId: args.workspaceId,
      deletedAt: null,
      sourceType: "EMAIL",
    },
    include: { communication: true },
  });
  if (!item?.communication) {
    return { status: "skipped", reason: "not_email_evidence" };
  }

  const comm = item.communication;
  const redacted = redactForLlm({
    bodyText: comm.bodyText,
    fromAddress: comm.fromAddress,
    toAddresses: comm.toAddresses,
  });

  // Idempotency: same evidence + content hash (covers duplicate QStash delivery).
  const existingByHash = await db.evidenceClassification.findFirst({
    where: {
      workspaceId: args.workspaceId,
      evidenceItemId: item.id,
      contentHash: redacted.contentHash,
      deletedAt: null,
    },
  });
  if (existingByHash) {
    await markClassificationComplete({
      workspaceId: args.workspaceId,
      evidenceItemId: item.id,
    });
    return { status: "duplicate", classificationId: existingByHash.id };
  }

  // Also skip if this prompt version already classified the item (any hash).
  const existingByPrompt = await db.evidenceClassification.findFirst({
    where: {
      workspaceId: args.workspaceId,
      evidenceItemId: item.id,
      promptVersion: {
        in: [EMAIL_CLASSIFICATION_PROMPT_VERSION, "heuristic-skip-v1"],
      },
      deletedAt: null,
    },
  });
  if (existingByPrompt) {
    await markClassificationComplete({
      workspaceId: args.workspaceId,
      evidenceItemId: item.id,
    });
    return { status: "duplicate", classificationId: existingByPrompt.id };
  }

  const prefilter = heuristicEmailPrefilter(redacted.text);

  // Non-candidate: record CLEAN without LLM (still audit evidence of review).
  // Random sample (~5%) still goes to LLM for false-negative measurement.
  const forceSample = !prefilter.candidate && Math.random() < 0.05;
  if (!prefilter.candidate && !forceSample) {
    const row = await db.evidenceClassification.create({
      data: {
        workspaceId: args.workspaceId,
        evidenceItemId: item.id,
        communicationId: comm.id,
        contentHash: redacted.contentHash,
        result: "CLEAN",
        modelId: null,
        promptVersion: "heuristic-skip-v1",
        signalCount: 0,
        rawResponse: { matchedTypes: [], sampled: false },
      },
    });
    await markClassificationComplete({
      workspaceId: args.workspaceId,
      evidenceItemId: item.id,
    });
    return { status: "clean", classificationId: row.id };
  }

  try {
    const llm = await classifyEmailWithLlm({
      bodyText: comm.bodyText,
      fromAddress: comm.fromAddress,
      toAddresses: comm.toAddresses,
    });

    const signals = llm.parsed.clean ? [] : llm.parsed.signals;
    const result = signals.length === 0 ? "CLEAN" : "FLAGGED";

    const classification = await db.$transaction(async (tx) => {
      const row = await tx.evidenceClassification.create({
        data: {
          workspaceId: args.workspaceId,
          evidenceItemId: item.id,
          communicationId: comm.id,
          contentHash: llm.contentHash,
          result,
          modelId: llm.modelId,
          promptVersion: llm.promptVersion,
          signalCount: signals.length,
          rawResponse: llm.parsed,
        },
      });

      const flagIds: string[] = [];
      for (const signal of signals) {
        const type = signal.category as FlagType;
        const dedupeKey = emailFlagDedupeKey(comm.id, type);
        const existingFlag = await tx.flag.findFirst({
          where: { workspaceId: args.workspaceId, dedupeKey },
          select: { id: true },
        });
        if (existingFlag) {
          flagIds.push(existingFlag.id);
          continue;
        }
        const created = await tx.flag.create({
          data: {
            workspaceId: args.workspaceId,
            meetingId: null,
            sourceType: "EMAIL",
            sourceId: comm.threadId,
            communicationId: comm.id,
            dedupeKey,
            type,
            severity: signal.severity as FlagSeverity,
            status: "OPEN",
            createdByType: "SYSTEM",
            evidence: {
              excerpt: signal.excerpt,
              rationale: signal.rationale,
              confidence: signal.confidence,
              communicationId: comm.id,
              threadId: comm.threadId,
              evidenceItemId: item.id,
              contentSha256: item.contentSha256,
            },
          },
        });
        flagIds.push(created.id);
      }

      return { row, flagIds };
    });

    await markClassificationComplete({
      workspaceId: args.workspaceId,
      evidenceItemId: item.id,
    });

    if (result === "CLEAN") {
      return { status: "clean", classificationId: classification.row.id };
    }
    return {
      status: "flagged",
      classificationId: classification.row.id,
      flagIds: classification.flagIds,
    };
  } catch (err) {
    const reason = err instanceof Error ? err.message : "classification_failed";
    return { status: "error", reason };
  }
}

/**
 * Mark FAILED after QStash has exhausted retries (or local fire-and-forget failure).
 */
export async function recordClassificationFailure(args: {
  workspaceId: string;
  evidenceItemId: string;
}): Promise<void> {
  await markClassificationFailed(args);
}

/** Test helper — force a signal type through persistence without LLM. */
export async function createEmailFlagForTests(args: {
  workspaceId: string;
  communicationId: string;
  threadId: string;
  evidenceItemId: string;
  type: EmailFlagType;
  contentSha256: string;
}): Promise<string> {
  const dedupeKey = emailFlagDedupeKey(args.communicationId, args.type);
  const flag = await db.flag.create({
    data: {
      workspaceId: args.workspaceId,
      meetingId: null,
      sourceType: "EMAIL",
      sourceId: args.threadId,
      communicationId: args.communicationId,
      dedupeKey,
      type: args.type,
      severity: "CRITICAL",
      status: "OPEN",
      createdByType: "SYSTEM",
      evidence: {
        excerpt: "test excerpt",
        rationale: "test",
        confidence: 0.9,
        communicationId: args.communicationId,
        threadId: args.threadId,
        evidenceItemId: args.evidenceItemId,
        contentSha256: args.contentSha256,
      },
    },
  });
  return flag.id;
}
