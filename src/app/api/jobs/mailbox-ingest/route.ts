import { z } from "zod";
import { processIngestJob } from "~/server/mailbox/ingest";

export const runtime = "nodejs";
export const maxDuration = 300;

const bodySchema = z.object({ jobId: z.string() });

export async function POST(request: Request): Promise<Response> {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await request.json());
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
