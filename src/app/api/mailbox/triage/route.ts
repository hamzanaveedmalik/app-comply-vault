import { requireAppAccess } from "~/server/auth/guards";
import { db } from "~/server/db";

export async function GET(): Promise<Response> {
  const access = await requireAppAccess();
  if (!access.ok) {
    return Response.json({ success: false, error: access.error }, { status: access.status });
  }

  const items = await db.emailTriageItem.findMany({
    where: { workspaceId: access.workspaceId, status: "PENDING" },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return Response.json({
    success: true,
    data: items.map((i) => ({
      id: i.id,
      address: i.address,
      status: i.status,
      userId: i.userId,
      clientId: i.clientId,
      createdAt: i.createdAt.toISOString(),
    })),
  });
}
