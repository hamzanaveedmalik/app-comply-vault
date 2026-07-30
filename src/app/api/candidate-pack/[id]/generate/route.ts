import { isRelease1DemoEnabled } from "~/lib/feature-flags";
import { requireAppAccess } from "~/server/auth/guards";
import { generateCandidatePack } from "~/server/candidate-pack/service";

export async function POST(
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

  try {
    const { id } = await params;
    const data = await generateCandidatePack({
      workspaceId: access.workspaceId,
      packId: id,
      userId: access.session.user.id,
    });
    return Response.json({ success: true, data });
  } catch (error) {
    return Response.json(
      { success: false, error: error instanceof Error ? error.message : "Could not generate candidate pack" },
      { status: 400 },
    );
  }
}
