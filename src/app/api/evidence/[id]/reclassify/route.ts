/**
 * POST /api/evidence/[id]/reclassify — re-queue failed email classification.
 */

import { requireAppAccess } from "~/server/auth/guards";
import { reclassifyEvidence } from "~/server/classification/enqueue";
import { isEmailIntelligenceEnabled } from "~/lib/feature-flags";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const access = await requireAppAccess();
  if (!access.ok) {
    return Response.json({ success: false, error: access.error }, { status: access.status });
  }
  if (!isEmailIntelligenceEnabled()) {
    return Response.json({ success: false, error: "Feature disabled" }, { status: 404 });
  }

  const { id } = await params;
  const result = await reclassifyEvidence({
    workspaceId: access.workspaceId,
    evidenceItemId: id,
  });

  if (!result.success) {
    return Response.json({ success: false, error: result.error }, { status: 404 });
  }

  return Response.json({ success: true });
}
