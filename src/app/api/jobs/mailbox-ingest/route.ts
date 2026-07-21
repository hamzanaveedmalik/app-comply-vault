/**
 * POST /api/jobs/mailbox-ingest
 * Processes a mailbox backfill/delta IngestJob.
 * Invoked by QStash (preferred on Vercel) — same pattern as teams-ingest.
 */

import { z } from "zod";
import { verifySignatureAppRouter } from "@upstash/qstash/nextjs";
import { processIngestJob } from "~/server/mailbox/ingest";

export const runtime = "nodejs";
export const maxDuration = 300;

const bodySchema = z.object({ jobId: z.string() });

async function handler(request: Request): Promise<Response> {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Invalid body" }, { status: 400 });
  }

  try {
    await processIngestJob(parsed.data.jobId);
    return Response.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "ingest_failed";
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
