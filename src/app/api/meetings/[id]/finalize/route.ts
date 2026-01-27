import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { z } from "zod";

const finalizeSchema = z.object({
  finalizeReason: z.enum([
    "COMPLETE_REVIEW",
    "REQUIRED_CHANGES_ADDRESSED",
    "EXCEPTION_APPROVED",
    "OTHER",
  ]),
  finalizeNote: z.string().optional(),
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

    // Verify user has OWNER_CCO role
    if (session.user.role !== "OWNER_CCO") {
      return Response.json(
        { error: "Forbidden: Only workspace owners (CCO) can finalize meetings" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const { finalizeReason, finalizeNote } = finalizeSchema.parse(body);

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

    if ((finalizeReason === "OTHER" || finalizeReason === "EXCEPTION_APPROVED") && !finalizeNote?.trim()) {
      return Response.json(
        { error: "Finalize note is required for this reason" },
        { status: 400 }
      );
    }

    const openCriticalFlags = await db.flag.findMany({
      where: {
        meetingId: meeting.id,
        status: {
          in: ["OPEN", "IN_REMEDIATION", "PENDING_VERIFICATION"],
        },
        severity: "CRITICAL",
      },
    });

    if (openCriticalFlags.length > 0 && finalizeReason !== "EXCEPTION_APPROVED") {
      return Response.json(
        {
          error: "Critical flags must be resolved or explicitly overridden before finalization",
          flags: openCriticalFlags.map((flag) => ({
            id: flag.id,
            type: flag.type,
            severity: flag.severity,
            status: flag.status,
          })),
        },
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
        finalizeReason,
        finalizeNote: finalizeNote?.trim() || null,
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
          finalizeReason,
          finalizeNote: finalizeNote?.trim() || null,
          flagsOverridden: openCriticalFlags.length > 0,
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
        finalizeReason: finalizedMeeting.finalizeReason,
        finalizeNote: finalizedMeeting.finalizeNote,
      },
    });
  } catch (error) {
    console.error("Error finalizing meeting:", error);
    if (error instanceof z.ZodError) {
      return Response.json(
        { error: "Invalid request body", details: error.errors },
        { status: 400 }
      );
    }
    return Response.json(
      { error: error instanceof Error ? error.message : "An unknown error occurred" },
      { status: 500 }
    );
  }
}

