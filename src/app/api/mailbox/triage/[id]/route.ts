import { requireAppAccess } from "~/server/auth/guards";
import {
  resolveTriageItem,
  backfillParticipantLinks,
} from "~/server/mailbox/participant-matching";
import { db } from "~/server/db";
import { z } from "zod";

const resolveSchema = z.object({
  status: z.enum(["CONFIRMED", "EXTERNAL", "IRRELEVANT"]),
  userId: z.string().optional().nullable(),
  clientId: z.string().optional().nullable(),
  notes: z.string().optional(),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
): Promise<Response> {
  const access = await requireAppAccess();
  if (!access.ok) {
    return Response.json({ success: false, error: access.error }, { status: access.status });
  }
  const { id } = await context.params;
  const parsed = resolveSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ success: false, error: "Invalid input" }, { status: 400 });
  }

  const item = await db.emailTriageItem.findFirst({
    where: { id, workspaceId: access.workspaceId },
  });
  if (!item) {
    return Response.json({ success: false, error: "Not found" }, { status: 404 });
  }

  await resolveTriageItem({
    workspaceId: access.workspaceId,
    triageId: id,
    status: parsed.data.status,
    userId: parsed.data.userId,
    clientId: parsed.data.clientId,
    resolvedBy: access.session.user.id,
    notes: parsed.data.notes,
  });

  if (parsed.data.status === "CONFIRMED") {
    await backfillParticipantLinks({
      workspaceId: access.workspaceId,
      address: item.address,
      userId: parsed.data.userId,
      clientId: parsed.data.clientId,
    });
  }

  await db.auditEvent.create({
    data: {
      workspaceId: access.workspaceId,
      userId: access.session.user.id,
      action: "EMAIL_TRIAGE_RESOLVED",
      resourceType: "email_triage",
      resourceId: id,
      metadata: { status: parsed.data.status },
    },
  });

  return Response.json({ success: true });
}
