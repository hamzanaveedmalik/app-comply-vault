/**
 * PATCH /api/meetings/attribution/[id] — manually set Meeting.clientId.
 */

import { z } from "zod";
import { requireAppAccess } from "~/server/auth/guards";
import { resolveMeetingClientAttribution } from "~/server/meetings/client-attribution";
import { isEmailIntelligenceEnabled } from "~/lib/feature-flags";

const bodySchema = z.object({
  clientId: z.string().min(1),
});

export async function PATCH(
  request: Request,
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
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ success: false, error: "Invalid body" }, { status: 400 });
  }

  const result = await resolveMeetingClientAttribution({
    workspaceId: access.workspaceId,
    meetingId: id,
    clientId: parsed.data.clientId,
    userId: access.session.user.id,
  });

  if (!result.success) {
    return Response.json({ success: false, error: result.error }, { status: 404 });
  }

  return Response.json({ success: true });
}
