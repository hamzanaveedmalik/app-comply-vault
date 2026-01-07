import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { publishProcessMeetingJob } from "~/server/qstash";
import { NextResponse } from "next/server";

/**
 * Manually retry processing a stuck meeting
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.workspaceId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const workspaceId = session.user.workspaceId;

    // Get meeting
    const meeting = await db.meeting.findFirst({
      where: {
        id: id,
        workspaceId,
      },
    });

    if (!meeting) {
      return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
    }

    if (!meeting.fileUrl) {
      return NextResponse.json(
        { error: "Meeting has no file URL - cannot retry processing" },
        { status: 400 }
      );
    }

    // Check if QStash is configured
    if (!process.env.QSTASH_TOKEN) {
      return NextResponse.json(
        { error: "QSTASH_TOKEN is not configured - cannot retry processing" },
        { status: 500 }
      );
    }

    // Publish new QStash job
    try {
      const messageId = await publishProcessMeetingJob({
        meetingId: meeting.id,
        workspaceId,
        fileUrl: meeting.fileUrl,
      });

      // Update status back to PROCESSING if it was in an error state
      if (meeting.status !== "PROCESSING") {
        await db.meeting.update({
          where: { id: meeting.id },
          data: { status: "PROCESSING" },
        });
      }

      // Check if upload_completed event exists, if not create it
      const existingUploadComplete = await db.auditEvent.findFirst({
        where: {
          workspaceId,
          meetingId: meeting.id,
          metadata: {
            path: ["action"],
            equals: "upload_completed",
          },
        },
      });

      // Log upload_completed event if missing
      if (!existingUploadComplete) {
        await db.auditEvent.create({
          data: {
            workspaceId,
            userId: session.user.id,
            action: "UPLOAD",
            resourceType: "meeting",
            resourceId: meeting.id,
            meetingId: meeting.id,
            metadata: {
              action: "upload_completed",
              qstashJobPublished: true,
              retroactivelyAdded: true,
            },
          },
        });
      }

      // Log retry event
      await db.auditEvent.create({
        data: {
          workspaceId,
          userId: session.user.id,
          action: "UPLOAD",
          resourceType: "meeting",
          resourceId: meeting.id,
          meetingId: meeting.id,
          metadata: {
            action: "manual_retry",
            messageId,
            previousStatus: meeting.status,
          },
        },
      });

      return NextResponse.json({
        success: true,
        message: "Processing job republished successfully",
        messageId,
        meetingId: meeting.id,
      });
    } catch (error) {
      console.error("Error republishing QStash job:", error);
      return NextResponse.json(
        {
          error: "Failed to republish processing job",
          details: error instanceof Error ? error.message : "Unknown error",
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Retry error:", error);
    return NextResponse.json(
      { error: "Failed to retry processing", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

