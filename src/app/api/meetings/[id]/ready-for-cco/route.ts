import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { z } from "zod";

const readyForCCOSchema = z.object({
  ready: z.boolean(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.workspaceId || !session.user.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Validate request body
    const body = await request.json();
    const { ready } = readyForCCOSchema.parse(body);

    // Find the meeting
    const meeting = await db.meeting.findFirst({
      where: {
        id,
        workspaceId: session.user.workspaceId,
      },
    });

    if (!meeting) {
      return Response.json({ error: "Meeting not found" }, { status: 404 });
    }

    // Only allow marking ready for CCO if meeting is in DRAFT_READY or DRAFT status
    if (meeting.status !== "DRAFT_READY" && meeting.status !== "DRAFT") {
      return Response.json(
        { error: "Meeting must be in DRAFT_READY or DRAFT status to mark as ready for CCO" },
        { status: 400 }
      );
    }

    // Update the meeting
    await db.meeting.update({
      where: { id },
      data: { readyForCCO: ready },
    });

    // Log audit event
    await db.auditEvent.create({
      data: {
        workspaceId: session.user.workspaceId,
        userId: session.user.id,
        action: "EDIT",
        resourceType: "meeting",
        resourceId: meeting.id,
        meetingId: meeting.id,
        metadata: {
          action: ready ? "marked_ready_for_cco" : "unmarked_ready_for_cco",
          timestamp: new Date().toISOString(),
        },
      },
    });

    return Response.json({ success: true, readyForCCO: ready });
  } catch (error) {
    console.error("Error marking meeting ready for CCO:", error);
    if (error instanceof z.ZodError) {
      return Response.json({ error: "Invalid request body", details: error.errors }, { status: 400 });
    }
    return Response.json(
      { error: error instanceof Error ? error.message : "An unknown error occurred" },
      { status: 500 }
    );
  }
}

