/**
 * POST /api/jobs/evidence-embed-backfill
 * Resumable embedding backfill. Payload: cursor + optional workspaceId only.
 */

import { z } from "zod";
import { verifySignatureAppRouter } from "@upstash/qstash/nextjs";
import { backfillEmailEmbeddings } from "~/server/ask/embeddings";
import { publishEvidenceEmbedBackfillJob } from "~/server/qstash";

export const runtime = "nodejs";
export const maxDuration = 300;

const bodySchema = z.object({
  workspaceId: z.string().optional(),
  cursor: z.string().nullable().optional(),
  batchSize: z.number().int().min(1).max(50).optional(),
});

async function handler(request: Request): Promise<Response> {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Invalid body" }, { status: 400 });
  }

  try {
    const stats = await backfillEmailEmbeddings({
      workspaceId: parsed.data.workspaceId,
      cursor: parsed.data.cursor ?? null,
      batchSize: parsed.data.batchSize,
    });

    if (!stats.done && stats.cursor) {
      await publishEvidenceEmbedBackfillJob({
        workspaceId: parsed.data.workspaceId,
        cursor: stats.cursor,
        batchSize: parsed.data.batchSize,
      });
    }

    return Response.json({ success: true, data: stats });
  } catch (err) {
    const message = err instanceof Error ? err.message : "embed_backfill_failed";
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
