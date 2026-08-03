import { z } from "zod";
import { isRelease1DemoEnabled } from "~/lib/feature-flags";
import { requireAppAccess } from "~/server/auth/guards";
import { approveCandidatePack } from "~/server/candidate-pack/service";

const approveSchema = z.object({
  includedMeetingIds: z.array(z.string()).default([]),
  includedEmailEvidenceIds: z.array(z.string()).default([]),
  acknowledgedCoverageLabels: z.array(z.string()).min(1),
});

export async function POST(
  request: Request,
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
    const body = approveSchema.parse(await request.json());
    const data = await approveCandidatePack({
      workspaceId: access.workspaceId,
      packId: id,
      userId: access.session.user.id,
      includedMeetingIds: body.includedMeetingIds,
      includedEmailEvidenceIds: body.includedEmailEvidenceIds,
      acknowledgedCoverageLabels: body.acknowledgedCoverageLabels,
    });
    return Response.json({ success: true, data });
  } catch (error) {
    return Response.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Could not approve candidate pack",
      },
      { status: 400 },
    );
  }
}
