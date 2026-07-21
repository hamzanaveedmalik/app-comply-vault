/**
 * GET /api/meetings/attribution — meetings needing client attribution.
 */

import { requireAppAccess } from "~/server/auth/guards";
import { listMeetingsNeedingAttribution } from "~/server/meetings/client-attribution";
import { isEmailIntelligenceEnabled } from "~/lib/feature-flags";

export async function GET(): Promise<Response> {
  const access = await requireAppAccess();
  if (!access.ok) {
    return Response.json({ success: false, error: access.error }, { status: access.status });
  }
  if (!isEmailIntelligenceEnabled()) {
    return Response.json({ success: false, error: "Feature disabled" }, { status: 404 });
  }

  const data = await listMeetingsNeedingAttribution(access.workspaceId);
  return Response.json({ success: true, data });
}
