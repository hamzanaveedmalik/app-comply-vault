import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { getWorkspaceMembership } from "~/server/firm-profile/workspace-access";
import { mapSuppressionLogDto } from "~/server/firm-profile/map-dtos";

export async function GET(
  request: Request,
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

  const url = new URL(request.url);
  const cursor = url.searchParams.get("cursor");
  const limit = Math.min(Number(url.searchParams.get("limit") ?? "50"), 100);

  const profile = await db.firmProfile.findFirst({
    where: { workspaceId, deletedAt: null },
    select: { id: true },
  });
  if (!profile) {
    return Response.json({ success: true, data: { entries: [], nextCursor: null } });
  }

  const entries = await db.suppressionLogEntry.findMany({
    where: {
      firmProfileId: profile.id,
      ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit + 1,
  });

  const hasMore = entries.length > limit;
  const page = hasMore ? entries.slice(0, limit) : entries;
  const nextCursor = hasMore ? page[page.length - 1]?.createdAt.toISOString() ?? null : null;

  return Response.json({
    success: true,
    data: {
      entries: page.map(mapSuppressionLogDto),
      nextCursor,
    },
  });
}
