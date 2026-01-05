import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { publishProcessMeetingJob } from "~/server/qstash";
import { env } from "~/env";
import { z } from "zod";

const completeUploadSchema = z.object({
  meetingId: z.string().uuid("Invalid meeting ID"),
});

/**
 * Complete upload: Verify file was uploaded and trigger processing
 * Called after client successfully uploads file directly to S3
 */
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.workspaceId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { meetingId } = completeUploadSchema.parse(body);

    // Verify meeting exists and belongs to user's workspace
    const meeting = await db.meeting.findFirst({
      where: {
        id: meetingId,
        workspaceId: session.user.workspaceId,
      },
    });

    if (!meeting) {
      return Response.json({ error: "Meeting not found" }, { status: 404 });
    }

    if (meeting.status !== "UPLOADING") {
      return Response.json(
        { error: "Meeting is not in UPLOADING status" },
        { status: 400 }
      );
    }

    // Update meeting status to PROCESSING and publish QStash job
    if (!env.QSTASH_TOKEN) {
      console.warn("⚠️ QSTASH_TOKEN not configured - jobs will not be published automatically");
      console.warn("   Meeting will stay in UPLOADING status. Configure QStash or manually trigger jobs.");
      
      // Still update status to indicate upload completed
      await db.meeting.update({
        where: { id: meeting.id },
        data: { status: "PROCESSING" },
      });
    } else {
      // Publish QStash job for background processing
      try {
        await publishProcessMeetingJob({
          meetingId: meeting.id,
          workspaceId: session.user.workspaceId,
          fileUrl: meeting.fileUrl ?? "",
        });

        // Update meeting status to PROCESSING
        await db.meeting.update({
          where: { id: meeting.id },
          data: { status: "PROCESSING" },
        });

        console.log(`✅ Meeting ${meeting.id} status updated to PROCESSING`);
      } catch (error) {
        console.error("❌ Error publishing QStash job:", error);
        console.error("   Meeting will stay in UPLOADING status. Check QStash configuration.");
        // Don't fail the completion if job publishing fails - job can be retried later
      }
    }

    // Log upload completion
    await db.auditEvent.create({
      data: {
        workspaceId: session.user.workspaceId,
        userId: session.user.id,
        action: "UPLOAD",
        resourceType: "meeting",
        resourceId: meeting.id,
        metadata: {
          action: "upload_completed",
        },
      },
    });

    return Response.json({
      meetingId: meeting.id,
      status: meeting.status,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ error: error.errors }, { status: 400 });
    }
    console.error("Error completing upload:", error);
    return Response.json(
      { error: "Failed to complete upload" },
      { status: 500 }
    );
  }
}

