import { auth } from "~/server/auth";
import { cookies } from "next/headers";
import { z } from "zod";
import { db } from "~/server/db";
import { ACTIVE_WORKSPACE_COOKIE } from "~/lib/workspace-constants";
import { activeUserWorkspaceWhere } from "~/lib/user-workspace-filters";

const switchBodySchema = z.object({
  workspaceId: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const json: unknown = await request.json();
    const { workspaceId } = switchBodySchema.parse(json);

    const membership = await db.userWorkspace.findFirst({
      where: { userId: session.user.id, workspaceId, ...activeUserWorkspaceWhere },
    });

    if (!membership) {
      return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const store = await cookies();
    store.set(ACTIVE_WORKSPACE_COOKIE, workspaceId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });

    return Response.json({ success: true });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json({ success: false, error: "Invalid body" }, { status: 400 });
    }
    console.error("POST /api/workspaces/switch:", e);
    return Response.json({ success: false, error: "Switch failed" }, { status: 500 });
  }
}
