import { requireAppAccess } from "~/server/auth/guards";
import { listMailboxConnections } from "~/server/mailbox/connections";
import { db } from "~/server/db";
import { z } from "zod";

const createSchema = z.object({
  mailboxAddress: z.string().email(),
});

export async function GET(): Promise<Response> {
  const access = await requireAppAccess();
  if (!access.ok) {
    return Response.json({ success: false, error: access.error }, { status: access.status });
  }
  const data = await listMailboxConnections(access.workspaceId);
  return Response.json({ success: true, data });
}

export async function POST(request: Request): Promise<Response> {
  const access = await requireAppAccess();
  if (!access.ok) {
    return Response.json({ success: false, error: access.error }, { status: access.status });
  }
  if (access.session.user.role !== "OWNER_CCO") {
    return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const body = createSchema.safeParse(await request.json());
  if (!body.success) {
    return Response.json({ success: false, error: "Invalid mailbox address" }, { status: 400 });
  }

  const connection = await db.mailboxConnection.create({
    data: {
      workspaceId: access.workspaceId,
      mailboxAddress: body.data.mailboxAddress.toLowerCase(),
      consentMode: "APPLICATION",
      status: "PENDING",
      scopeFolders: [],
    },
  });

  await db.auditEvent.create({
    data: {
      workspaceId: access.workspaceId,
      userId: access.session.user.id,
      action: "MAILBOX_CONNECTED",
      resourceType: "mailbox_connection",
      resourceId: connection.id,
      metadata: { consentMode: "APPLICATION" },
    },
  });

  return Response.json({ success: true, data: { id: connection.id } });
}
