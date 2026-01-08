import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { publishProcessMeetingJob } from "~/server/qstash";
import { env } from "~/env";
import { createErrorResponse, AppError, ErrorMessages } from "~/server/errors";
import { z } from "zod";

const retrySchema = z.object({
  type: z.enum(["upload", "processing"]).optional().default("processing"),
});

/**
 * Retry failed upload or processing
 * Supports idempotency - can be called multiple times safely
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.workspaceId) {
      throw new AppError(
        "You need to sign in to retry this meeting",
        401,
        "Please sign in and try again",
        "UNAUTHORIZED"
      );
    }

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const { type } = retrySchema.parse(body);

    // Verify meeting exists and belongs to user's workspace
    const meeting = await db.meeting.findFirst({
      where: {
        id,
        workspaceId: session.user.workspaceId,
      },
    });

    if (!meeting) {
      throw new AppError(
        ErrorMessages.MEETING_NOT_FOUND.message,
        404,
        ErrorMessages.MEETING_NOT_FOUND.action,
        "MEETING_NOT_FOUND"
      );
    }

    // Determine what to retry based on type and current status
    if (type === "upload") {
      // Retry upload - reset to UPLOADING status
      if (meeting.status === "FINALIZED") {
        throw new AppError(
          "Cannot retry upload for finalized meetings",
          400,
          "Finalized meetings cannot be modified",
          "FINALIZED_MEETING"
        );
      }

      await db.meeting.update({
        where: { id: meeting.id },
        data: {
          status: "UPLOADING",
          // Clear any error metadata
          transcript: null,
          extraction: null,
        },
      });

      // Log retry
      await db.auditEvent.create({
        data: {
          workspaceId: session.user.workspaceId,
          userId: session.user.id,
          action: "UPLOAD",
          resourceType: "meeting",
          resourceId: meeting.id,
          meetingId: meeting.id,
          metadata: {
            action: "upload_retry",
            retriedBy: session.user.id,
            previousStatus: meeting.status,
          },
        },
      });

      return Response.json({
        success: true,
        message: "Upload retry initiated. Please upload the file again.",
        meetingId: meeting.id,
        status: "UPLOADING",
      });
    } else {
      // Retry processing - republish QStash job
      if (!meeting.fileUrl) {
        throw new AppError(
          "Cannot retry processing: no file found",
          400,
          "Please upload the file first",
          "NO_FILE"
        );
      }

      if (meeting.status === "FINALIZED") {
        throw new AppError(
          "Cannot retry processing for finalized meetings",
          400,
          "Finalized meetings cannot be reprocessed",
          "FINALIZED_MEETING"
        );
      }

      // Check if QStash is configured
      if (!env.QSTASH_TOKEN) {
        throw new AppError(
          "Processing service is not configured",
          503,
          "Please contact support@complyvault.com",
          "SERVICE_UNAVAILABLE"
        );
      }

      // Republish QStash job
      try {
        const messageId = await publishProcessMeetingJob({
          meetingId: meeting.id,
          workspaceId: session.user.workspaceId,
          fileUrl: meeting.fileUrl,
        });

        // Update status to PROCESSING
        await db.meeting.update({
          where: { id: meeting.id },
          data: {
            status: "PROCESSING",
            // Clear any previous error metadata
            transcript: meeting.transcript && typeof meeting.transcript === "object" && "error" in meeting.transcript
              ? null
              : meeting.transcript,
            extraction: meeting.extraction && typeof meeting.extraction === "object" && "error" in meeting.extraction
              ? null
              : meeting.extraction,
          },
        });

        // Log retry
        await db.auditEvent.create({
          data: {
            workspaceId: session.user.workspaceId,
            userId: session.user.id,
            action: "UPLOAD",
            resourceType: "meeting",
            resourceId: meeting.id,
            meetingId: meeting.id,
            metadata: {
              action: "processing_retry",
              retriedBy: session.user.id,
              previousStatus: meeting.status,
              qstashMessageId: messageId,
            },
          },
        });

        return Response.json({
          success: true,
          message: "Processing retry initiated. The meeting will be processed shortly.",
          meetingId: meeting.id,
          status: "PROCESSING",
          qstashMessageId: messageId,
        });
      } catch (qstashError) {
        console.error("Error publishing QStash job for retry:", qstashError);
        throw new AppError(
          "Failed to initiate processing retry",
          500,
          "Please try again in a moment or contact support",
          "QSTASH_ERROR"
        );
      }
    }
  } catch (error) {
    if (error instanceof AppError) {
      return Response.json(error.toJSON(), { status: error.statusCode });
    }
    return createErrorResponse(error, {
      endpoint: "/api/meetings/[id]/retry",
      action: "retry_meeting",
    });
  }
}

