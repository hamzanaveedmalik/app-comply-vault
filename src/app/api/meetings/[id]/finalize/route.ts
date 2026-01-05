import { auth } from "~/server/auth";
import { db } from "~/server/db";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.workspaceId || !session.user.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify user has OWNER_CCO role
    if (session.user.role !== "OWNER_CCO") {
      return Response.json(
        { error: "Forbidden: Only workspace owners (CCO) can finalize meetings" },
        { status: 403 }
      );
    }

    const { id } = await params;

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

    // Only allow finalization if meeting is in DRAFT_READY or DRAFT status
    if (meeting.status !== "DRAFT_READY" && meeting.status !== "DRAFT") {
      return Response.json(
        { error: `Meeting must be in DRAFT_READY or DRAFT status to finalize. Current status: ${meeting.status}` },
        { status: 400 }
      );
    }

    // Calculate Time-to-Finalize if draftReadyAt exists
    let timeToFinalize: number | null = null;
    const now = new Date();
    if (meeting.draftReadyAt) {
      const diffMs = now.getTime() - meeting.draftReadyAt.getTime();
      timeToFinalize = Math.floor(diffMs / 1000); // Convert to seconds
    }

    // Update the meeting to FINALIZED status
    const finalizedMeeting = await db.meeting.update({
      where: { id },
      data: {
        status: "FINALIZED",
        finalizedBy: session.user.id,
        finalizedAt: now,
        timeToFinalize,
      },
    });

    // Log FINALIZE audit event
    await db.auditEvent.create({
      data: {
        workspaceId: session.user.workspaceId,
        userId: session.user.id,
        action: "FINALIZE",
        resourceType: "meeting",
        resourceId: meeting.id,
        meetingId: meeting.id,
        metadata: {
          finalizedAt: now.toISOString(),
          previousStatus: meeting.status,
          timeToFinalize: timeToFinalize ? `${timeToFinalize}s` : null,
        },
      },
    });

    return Response.json({
      success: true,
      meeting: {
        id: finalizedMeeting.id,
        status: finalizedMeeting.status,
        finalizedAt: finalizedMeeting.finalizedAt,
        finalizedBy: finalizedMeeting.finalizedBy,
        timeToFinalize: finalizedMeeting.timeToFinalize,
      },
    });
  } catch (error) {
    console.error("Error finalizing meeting:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "An unknown error occurred" },
      { status: 500 }
    );
  }
}

