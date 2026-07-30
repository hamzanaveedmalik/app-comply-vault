import { isRelease1DemoEnabled } from "~/lib/feature-flags";
import { requireAppAccess } from "~/server/auth/guards";
import { getCandidatePack } from "~/server/candidate-pack/service";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  if (!isRelease1DemoEnabled()) {
    return Response.json({ success: false, error: "Not found" }, { status: 404 });
  }

  const access = await requireAppAccess();
  if (!access.ok) {
    return Response.json({ success: false, error: access.error }, { status: access.status });
  }
  if (access.session.user.role !== "OWNER_CCO") {
    return Response.json({ success: false, error: "CCO access required" }, { status: 403 });
  }

  const { id } = await params;
  const data = await getCandidatePack({ workspaceId: access.workspaceId, packId: id });
  if (!data) {
    return Response.json({ success: false, error: "Candidate pack not found" }, { status: 404 });
  }
  return Response.json({ success: true, data });
}
