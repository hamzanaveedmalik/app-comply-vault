import { requireAppAccess } from "~/server/auth/guards";
import { buildThreadExport } from "~/server/export/thread-export";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> }
): Promise<Response> {
  const access = await requireAppAccess();
  if (!access.ok) {
    return Response.json({ success: false, error: access.error }, { status: access.status });
  }
  const { id } = await context.params;

  try {
    const result = await buildThreadExport({
      workspaceId: access.workspaceId,
      threadId: id,
      userId: access.session.user.id,
    });

    return new Response(new Uint8Array(result.zipBuffer), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="thread-${id}.zip"`,
        "X-Manifest-Sha256": result.manifestSha256,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "export_failed";
    return Response.json({ success: false, error: message }, { status: 400 });
  }
}
