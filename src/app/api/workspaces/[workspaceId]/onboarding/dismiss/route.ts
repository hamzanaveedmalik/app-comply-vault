import { auth } from "~/server/auth";
import { db } from "~/server/db";

export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ workspaceId: string }> },
): Promise<Response> {
  try {
    const session = await auth();
    if (!session?.user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { workspaceId } = await params;

    const membership = await db.userWorkspace.findUnique({
      where: {
        userId_workspaceId: {
          userId: session.user.id,
          workspaceId,
        },
      },
    });

    if (!membership) {
      return Response.json({ error: "Not a workspace member" }, { status: 404 });
    }

    await db.userWorkspace.update({
      where: {
        userId_workspaceId: {
          userId: session.user.id,
          workspaceId,
        },
      },
      data: { onboardingDismissedAt: new Date() },
    });

    return Response.json({ success: true });
  } catch (error) {
    console.error("Error dismissing onboarding:", error);
    return Response.json({ error: "Failed to dismiss onboarding" }, { status: 500 });
  }
}
