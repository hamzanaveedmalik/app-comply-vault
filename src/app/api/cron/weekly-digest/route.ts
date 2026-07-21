/**
 * GET/POST /api/cron/weekly-digest — Epic 5.1 weekly email digest
 * Vercel Cron (GET) or manual trigger with CRON_SECRET
 */

import { db } from "~/server/db";
import { sendWeeklyActivityDigest } from "~/server/email";
import { env } from "~/env";
import { activeUserWorkspaceWhere } from "~/lib/user-workspace-filters";

export const maxDuration = 60;

function unauthorized(): Response {
  return new Response("Unauthorized", { status: 401 });
}

async function run(): Promise<Response> {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const periodLabel = `${weekAgo.toLocaleDateString()} – ${now.toLocaleDateString()}`;

  const workspaces = await db.workspace.findMany({
    where: {
      billingStatus: { not: "CANCELED" },
    },
    select: { id: true, name: true },
  });

  let sent = 0;
  let failed = 0;

  for (const ws of workspaces) {
    const owners = await db.userWorkspace.findMany({
      where: { workspaceId: ws.id, role: "OWNER_CCO", ...activeUserWorkspaceWhere },
      include: { user: { select: { email: true } } },
    });
    if (owners.length === 0) continue;

    const [newMeetings, finalized, draftReady, openFlags] = await Promise.all([
      db.meeting.count({
        where: { workspaceId: ws.id, createdAt: { gte: weekAgo } },
      }),
      db.meeting.count({
        where: { workspaceId: ws.id, status: "FINALIZED", finalizedAt: { gte: weekAgo } },
      }),
      db.meeting.count({
        where: { workspaceId: ws.id, status: { in: ["DRAFT_READY", "DRAFT"] } },
      }),
      db.flag.count({
        where: {
          workspaceId: ws.id,
          status: { in: ["OPEN", "IN_REMEDIATION", "PENDING_VERIFICATION"] },
        },
      }),
    ]);

    for (const o of owners) {
      const email = o.user.email;
      if (!email) continue;
      const r = await sendWeeklyActivityDigest({
        email,
        workspaceName: ws.name,
        periodLabel,
        stats: { newMeetings, finalized, draftReady, openFlags },
      });
      if (r.success) sent++;
      else failed++;
    }
  }

  return Response.json({ success: true, sent, failed, workspaces: workspaces.length });
}

export async function GET(request: Request): Promise<Response> {
  const authHeader = request.headers.get("authorization");
  const secret = env.CRON_SECRET;
  if (secret && authHeader !== `Bearer ${secret}`) {
    return unauthorized();
  }
  try {
    return await run();
  } catch (e) {
    console.error("weekly-digest", e);
    return Response.json(
      { success: false, error: e instanceof Error ? e.message : "error" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request): Promise<Response> {
  const authHeader = request.headers.get("authorization");
  const secret = env.CRON_SECRET;
  if (secret && authHeader !== `Bearer ${secret}`) {
    return unauthorized();
  }
  try {
    return await run();
  } catch (e) {
    console.error("weekly-digest", e);
    return Response.json(
      { success: false, error: e instanceof Error ? e.message : "error" },
      { status: 500 }
    );
  }
}
