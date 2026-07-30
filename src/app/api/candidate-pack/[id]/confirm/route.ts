import { z } from "zod";
import { isRelease1DemoEnabled } from "~/lib/feature-flags";
import { requireAppAccess } from "~/server/auth/guards";
import { confirmCandidatePackScope } from "~/server/candidate-pack/service";

const confirmedScopeSchema = z.object({
  people: z.array(z.string().trim().min(1)).max(50),
  entities: z.array(z.string().trim().min(1)).max(50),
  dateFrom: z.string().nullable(),
  dateTo: z.string().nullable(),
  channels: z.array(z.enum(["EMAIL", "MEETING"])).min(1),
  concepts: z.array(z.string().trim().min(1)).max(50),
  exclusions: z.array(z.string().trim().min(1)).max(50),
});

const confirmSchema = z.object({ scope: confirmedScopeSchema });

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
    const [{ id }, body] = await Promise.all([params, request.json() as Promise<unknown>]);
    const { scope } = confirmSchema.parse(body);
    const data = await confirmCandidatePackScope({
      workspaceId: access.workspaceId,
      packId: id,
      userId: access.session.user.id,
      scope,
    });
    return Response.json({ success: true, data });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ success: false, error: "Invalid candidate scope" }, { status: 400 });
    }
    return Response.json(
      { success: false, error: error instanceof Error ? error.message : "Could not confirm candidate scope" },
      { status: 400 },
    );
  }
}
