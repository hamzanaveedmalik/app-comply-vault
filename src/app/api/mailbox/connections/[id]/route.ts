import { requireAppAccess } from "~/server/auth/guards";
import { db } from "~/server/db";
import { z } from "zod";

const scopeSchema = z.object({
  scopeFolders: z.array(z.string()).min(1),
  backfillFrom: z.string().datetime().optional(),
});

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
): Promise<Response> {
  const access = await requireAppAccess();
  if (!access.ok) {
    return Response.json({ success: false, error: access.error }, { status: access.status });
  }
  const { id } = await context.params;

  const connection = await db.mailboxConnection.findFirst({
    where: { id, workspaceId: access.workspaceId, deletedAt: null },
  });
  if (!connection) {
    return Response.json({ success: false, error: "Not found" }, { status: 404 });
  }

  return Response.json({
    success: true,
    data: {
      id: connection.id,
      mailboxAddress: connection.mailboxAddress,
      scopeFolders: connection.scopeFolders,
      backfillFrom: connection.backfillFrom?.toISOString() ?? null,
      status: connection.status,
      lastSyncAt: connection.lastSyncAt?.toISOString() ?? null,
      lastErrorMessage: connection.lastErrorMessage,
    },
  });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
): Promise<Response> {
  const access = await requireAppAccess();
  if (!access.ok) {
    return Response.json({ success: false, error: access.error }, { status: access.status });
  }
  if (access.session.user.role !== "OWNER_CCO") {
    return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  const parsed = scopeSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ success: false, error: "Invalid scope" }, { status: 400 });
  }

  const updated = await db.mailboxConnection.updateMany({
    where: { id, workspaceId: access.workspaceId, deletedAt: null },
    data: {
      scopeFolders: parsed.data.scopeFolders,
      backfillFrom: parsed.data.backfillFrom
        ? new Date(parsed.data.backfillFrom)
        : undefined,
    },
  });
  if (updated.count === 0) {
    return Response.json({ success: false, error: "Not found" }, { status: 404 });
  }

  return Response.json({ success: true });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
): Promise<Response> {
  const access = await requireAppAccess();
  if (!access.ok) {
    return Response.json({ success: false, error: access.error }, { status: access.status });
  }
  if (access.session.user.role !== "OWNER_CCO") {
    return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  const result = await db.mailboxConnection.updateMany({
    where: { id, workspaceId: access.workspaceId, deletedAt: null },
    data: { deletedAt: new Date(), status: "DISCONNECTED" },
  });
  if (result.count === 0) {
    return Response.json({ success: false, error: "Not found" }, { status: 404 });
  }

  await db.auditEvent.create({
    data: {
      workspaceId: access.workspaceId,
      userId: access.session.user.id,
      action: "MAILBOX_DISCONNECTED",
      resourceType: "mailbox_connection",
      resourceId: id,
    },
  });

  return Response.json({ success: true });
}
