import { auth } from "~/server/auth";
import { db } from "~/server/db";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.workspaceId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get("workspaceId");

  if (!workspaceId || workspaceId !== session.user.workspaceId) {
    return Response.json({ error: "Workspace access denied" }, { status: 403 });
  }

  const workspace = await db.workspace.findUnique({
    where: { id: workspaceId },
    select: {
      billingStatus: true,
      planTier: true,
      onboardingType: true,
    },
  });

  if (!workspace) {
    return Response.json({ error: "Workspace not found" }, { status: 404 });
  }

  return Response.json({
    billingStatus: workspace.billingStatus,
    planTier: workspace.planTier,
    onboardingType: workspace.onboardingType,
  });
}
