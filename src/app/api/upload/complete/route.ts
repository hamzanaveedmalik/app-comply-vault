import { requireAppAccess } from "~/server/auth/guards";
import { db } from "~/server/db";
import { publishProcessMeetingJob } from "~/server/qstash";
import { getSignedFileUrl } from "~/server/storage";
import { sha256FromResponseBody } from "~/server/hash";
import { env } from "~/env";
import { createErrorResponse, AppError, ErrorMessages } from "~/server/errors";
import { z } from "zod";

const completeUploadSchema = z.object({
  meetingId: z.string().min(1, "Meeting ID is required"),
  // Note: Prisma uses CUID format, not UUID, so we validate as a non-empty string
});

export const runtime = "nodejs";

/**
 * Complete upload: Verify file was uploaded and trigger processing
 * Called after client successfully uploads file directly to S3
 */
export async function POST(request: Request) {
  try {
    const access = await requireAppAccess();
    if (!access.ok) {
      return Response.json({ error: access.error }, { status: access.status });
    }
    const { session, workspaceId } = access;

    const body = await request.json();
    const { meetingId } = completeUploadSchema.parse(body);

    // Verify meeting exists and belongs to user's workspace
    const meeting = await db.meeting.findFirst({
      where: {
        id: meetingId,
        workspaceId: workspaceId,
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

    if (meeting.status !== "UPLOADING") {
      throw new AppError(
        "Upload cannot be completed. The meeting is not in the correct state.",
        400,
        "Please try uploading the file again",
        "INVALID_STATUS"
      );
    }

    // Compute SHA-256 hash for provenance if missing
    let sourceFileSha256 = meeting.sourceFileSha256 ?? null;
    if (!sourceFileSha256 && meeting.fileUrl) {
      try {
        const signedUrl = await getSignedFileUrl(meeting.fileUrl, 900);
        const response = await fetch(signedUrl);
        if (!response.ok) {
          throw new Error(`Failed to fetch uploaded file (status ${response.status})`);
        }
        sourceFileSha256 = await sha256FromResponseBody(response.body);
      } catch (hashError) {
        console.error("❌ Failed to compute file hash:", hashError);
      }
    }

    if (sourceFileSha256 || !meeting.sourceUploadedAt) {
      await db.meeting.update({
        where: { id: meeting.id },
        data: {
          sourceFileSha256: sourceFileSha256 ?? undefined,
          sourceUploadedAt: meeting.sourceUploadedAt ?? new Date(),
        },
      });
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
        const messageId = await publishProcessMeetingJob({
          meetingId: meeting.id,
          workspaceId: workspaceId,
          fileUrl: meeting.fileUrl ?? "",
        });

        // Update meeting status to PROCESSING
        await db.meeting.update({
          where: { id: meeting.id },
          data: { status: "PROCESSING" },
        });

        console.log(`✅ Meeting ${meeting.id} status updated to PROCESSING. QStash message ID: ${messageId}`);
      } catch (error) {
        console.error("❌ Error publishing QStash job:", error);
        if (error instanceof Error) {
          console.error("Error message:", error.message);
        }
        console.error("   Meeting will stay in UPLOADING status. Check QStash configuration.");
        console.error("   Required env vars: QSTASH_TOKEN, NEXT_PUBLIC_APP_URL");
        // Don't fail the completion if job publishing fails - job can be retried later
        // But log a warning in the response
        return Response.json({
          meetingId: meeting.id,
          status: "UPLOADING",
          warning: "Upload completed but processing may be delayed. Please contact support if processing doesn't start.",
        });
      }
    }

    // Log upload completion - always log, even if QStash job publishing failed
    await db.auditEvent.create({
      data: {
        workspaceId: workspaceId,
        userId: session.user.id,
        action: "UPLOAD",
        resourceType: "meeting",
        resourceId: meeting.id,
        meetingId: meeting.id,
        metadata: {
          action: "upload_completed",
          qstashJobPublished: !!env.QSTASH_TOKEN && meeting.status === "PROCESSING",
          sha256: sourceFileSha256 ?? undefined,
        },
      },
    });

    return Response.json({
      meetingId: meeting.id,
      status: meeting.status,
    });
  } catch (error) {
    if (error instanceof AppError) {
      return Response.json(error.toJSON(), { status: error.statusCode });
    }
    return createErrorResponse(error, {
      endpoint: "/api/upload/complete",
      action: "upload_complete",
    });
  }
}

