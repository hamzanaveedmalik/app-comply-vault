/**
 * POST /api/jobs/email-classify
 * Async email classification. Payload: { workspaceId, evidenceItemId } only.
 */

import { z } from "zod";
import { verifySignatureAppRouter } from "@upstash/qstash/nextjs";
import {
  classifyEmailEvidence,
  recordClassificationFailure,
} from "~/server/classification/persist-email-classification";

export const runtime = "nodejs";
export const maxDuration = 120;

const bodySchema = z.object({
  workspaceId: z.string().min(1),
  evidenceItemId: z.string().min(1),
});

/** QStash retries: 3 → final attempt has Upstash-Retried === "3". */
const MAX_RETRIES = 3;

async function handler(request: Request): Promise<Response> {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Invalid body" }, { status: 400 });
  }

  const retried = Number(request.headers.get("Upstash-Retried") ?? "0");
  const { workspaceId, evidenceItemId } = parsed.data;

  try {
    const result = await classifyEmailEvidence({ workspaceId, evidenceItemId });

    if (result.status === "error") {
      if (retried >= MAX_RETRIES) {
        await recordClassificationFailure({ workspaceId, evidenceItemId });
        return Response.json({
          success: false,
          failed: true,
          reason: result.reason,
        });
      }
      return Response.json(
        { success: false, error: result.reason },
        { status: 500 }
      );
    }

    // One queue hop: embed after successful classification (ids-only payload already).
    if (
      result.status === "clean" ||
      result.status === "flagged" ||
      result.status === "duplicate"
    ) {
      try {
        const { embedEmailEvidence } = await import("~/server/ask/embeddings");
        await embedEmailEvidence({ workspaceId, evidenceItemId });
      } catch {
        // Embedding failure must not fail classification delivery.
      }
    }

    return Response.json({ success: true, data: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "classify_failed";
    if (retried >= MAX_RETRIES) {
      await recordClassificationFailure({ workspaceId, evidenceItemId });
      return Response.json({ success: false, failed: true, reason: message });
    }
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}

const isProduction = process.env.NODE_ENV === "production";
const hasSigningKeys = !!(
  process.env.QSTASH_CURRENT_SIGNING_KEY || process.env.QSTASH_NEXT_SIGNING_KEY
);

export const POST =
  isProduction && hasSigningKeys
    ? (() => {
        try {
          return verifySignatureAppRouter(handler);
        } catch {
          return handler;
        }
      })()
    : handler;
