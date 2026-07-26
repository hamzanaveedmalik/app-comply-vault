/**
 * GET/POST /api/cron/seal-reconcile — CV-TR-01 nightly FINALIZED ↔ RecordSeal check.
 */

import { env } from "~/env";
import { reconcileRecordSeals } from "~/server/seal/reconcile";

export const maxDuration = 60;

function unauthorized(): Response {
  return new Response("Unauthorized", { status: 401 });
}

async function run(): Promise<Response> {
  const report = await reconcileRecordSeals();
  return Response.json({
    ok: report.alerts.length === 0,
    ...report,
  });
}

function authorize(request: Request): boolean {
  const secret = env.CRON_SECRET;
  if (!secret) {
    return process.env.NODE_ENV !== "production";
  }
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

export async function GET(request: Request): Promise<Response> {
  if (!authorize(request)) return unauthorized();
  return run();
}

export async function POST(request: Request): Promise<Response> {
  if (!authorize(request)) return unauthorized();
  return run();
}
