import { auth } from "~/server/auth";
import { db } from "~/server/db";
import {
  canWriteCockpit,
  getWorkspaceMembership,
} from "~/server/firm-profile/workspace-access";
import { ApproveProfileError, approveFirmProfile } from "~/server/firm-profile/approve-firm-profile";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ workspaceId: string }> },
): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { workspaceId } = await params;
  const access = await getWorkspaceMembership(session.user.id, workspaceId);
  if (!access.ok) {
    return Response.json({ error: "Forbidden" }, { status: access.status });
  }
  if (!canWriteCockpit(access.role)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const profile = await db.firmProfile.findFirst({
    where: { workspaceId, deletedAt: null, status: "ACTIVE" },
  });
  if (!profile) {
    return Response.json({ error: "Active firm profile required" }, { status: 404 });
  }

  try {
    const result = await approveFirmProfile({
      workspaceId,
      firmProfileId: profile.id,
      userId: session.user.id,
    });
    return Response.json({ success: true, data: result });
  } catch (err) {
    if (err instanceof ApproveProfileError) {
      return Response.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }
}
