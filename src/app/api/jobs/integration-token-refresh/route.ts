/**
 * POST /api/jobs/integration-token-refresh
 * Epic 6 Story 6.2: Token refresh runs every 15 mins
 * Call via Vercel Cron or QStash
 */

import { refreshExpiringTokens } from "~/server/integrations/token-refresh";

export const maxDuration = 60;

export async function POST(request: Request) {
  // Verify cron secret to prevent unauthorized calls
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const { refreshed, failed } = await refreshExpiringTokens();
    return Response.json({ success: true, refreshed, failed });
  } catch (error) {
    console.error("Token refresh job failed:", error);
    return Response.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
