import { requireAppAccess } from "~/server/auth/guards";
import { getClientDetail } from "~/server/clients/queries";
import { isEmailIntelligenceEnabled } from "~/lib/feature-flags";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
): Promise<Response> {
  const access = await requireAppAccess();
  if (!access.ok) {
    return Response.json({ success: false, error: access.error }, { status: access.status });
  }
  if (!isEmailIntelligenceEnabled()) {
    return Response.json({ success: false, error: "Feature disabled" }, { status: 404 });
  }

  const { id } = await context.params;
  const data = await getClientDetail({
    workspaceId: access.workspaceId,
    clientId: id,
  });
  if (!data) {
    return Response.json({ success: false, error: "Not found" }, { status: 404 });
  }

  return Response.json({ success: true, data });
}
