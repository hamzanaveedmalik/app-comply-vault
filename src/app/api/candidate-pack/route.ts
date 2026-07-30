import { z } from "zod";
import { isRelease1DemoEnabled } from "~/lib/feature-flags";
import { requireAppAccess } from "~/server/auth/guards";
import { createCandidatePackDraft } from "~/server/candidate-pack/service";

const createCandidatePackSchema = z.object({
  requestText: z.string().trim().min(10).max(20_000),
});

export async function POST(request: Request): Promise<Response> {
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
    const body: unknown = await request.json();
    const { requestText } = createCandidatePackSchema.parse(body);
    const data = await createCandidatePackDraft({
      workspaceId: access.workspaceId,
      requestText,
      userId: access.session.user.id,
    });
    return Response.json({ success: true, data }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ success: false, error: "Invalid request body" }, { status: 400 });
    }
    return Response.json(
      { success: false, error: error instanceof Error ? error.message : "Could not create candidate pack" },
      { status: 400 },
    );
  }
}
