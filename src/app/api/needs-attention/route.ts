import { isRelease1DemoEnabled } from "~/lib/feature-flags";
import { requireAppAccess } from "~/server/auth/guards";
import { listNeedsAttention } from "~/server/needs-attention/list";

export async function GET(): Promise<Response> {
  if (!isRelease1DemoEnabled()) {
    return Response.json({ success: false, error: "Not found" }, { status: 404 });
  }

  const access = await requireAppAccess();
  if (!access.ok) {
    return Response.json({ success: false, error: access.error }, { status: access.status });
  }

  const data = await listNeedsAttention(access.workspaceId);
  return Response.json({ success: true, data });
}
