import { requireAppAccess } from "~/server/auth/guards";
import { getThreadDetail } from "~/server/mailbox/threads";
import { db } from "~/server/db";
import { z } from "zod";

const tagSchema = z.object({
  category: z.enum([
    "ADVICE",
    "RECOMMENDATION",
    "COMPLAINT",
    "FEE",
    "PERFORMANCE",
    "MARKETING",
    "REVIEW",
    "VULNERABLE_CLIENT",
    "OFF_CHANNEL",
  ]),
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

  const detail = await getThreadDetail({
    workspaceId: access.workspaceId,
    threadId: id,
  });
  if (!detail) {
    return Response.json({ success: false, error: "Not found" }, { status: 404 });
  }

  await db.auditEvent.create({
    data: {
      workspaceId: access.workspaceId,
      userId: access.session.user.id,
      action: "EVIDENCE_VIEW",
      resourceType: "communication_thread",
      resourceId: id,
    },
  });

  return Response.json({ success: true, data: detail });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
): Promise<Response> {
  const access = await requireAppAccess();
  if (!access.ok) {
    return Response.json({ success: false, error: access.error }, { status: access.status });
  }
  const { id } = await context.params;
  const parsed = tagSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ success: false, error: "Invalid tag" }, { status: 400 });
  }

  const thread = await db.communicationThread.findFirst({
    where: { id, workspaceId: access.workspaceId, deletedAt: null },
    include: { messages: { select: { evidenceItemId: true } } },
  });
  if (!thread) {
    return Response.json({ success: false, error: "Not found" }, { status: 404 });
  }

  for (const msg of thread.messages) {
    await db.evidenceTag.create({
      data: {
        itemId: msg.evidenceItemId,
        category: parsed.data.category,
        addedBy: access.session.user.id,
      },
    });
    await db.auditEvent.create({
      data: {
        workspaceId: access.workspaceId,
        userId: access.session.user.id,
        action: "EVIDENCE_TAG",
        resourceType: "evidence_item",
        resourceId: msg.evidenceItemId,
        metadata: { category: parsed.data.category, threadId: id },
      },
    });
  }

  return Response.json({ success: true });
}
