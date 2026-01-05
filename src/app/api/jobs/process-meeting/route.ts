import { db } from "~/server/db";
import { verifySignatureAppRouter } from "@upstash/qstash/nextjs";
import { z } from "zod";
import { transcribeAudio } from "~/server/transcription";
import { getSignedFileUrl } from "~/server/storage";
import { sendDraftReadyEmail } from "~/server/email";

const processMeetingSchema = z.object({
  meetingId: z.string(),
  workspaceId: z.string(),
  fileUrl: z.string().min(1), // S3 key, not a URL (e.g., "workspaces/{workspaceId}/meetings/{meetingId}/recording.mp3")
});

/**
 * QStash webhook handler for processing meetings
 * This endpoint is called by QStash after a job is published
 * 
 * Flow:
 * 1. Transcribe audio using Deepgram/AssemblyAI
 * 2. Store transcript in database
 * 3. Update status to DRAFT_READY (extraction will be added in EPIC 3)
 */
async function handler(request: Request) {
  try {
    const body = await request.json();
    const { meetingId, workspaceId, fileUrl } = processMeetingSchema.parse(body);

    // Verify meeting exists and belongs to workspace
    const meeting = await db.meeting.findFirst({
      where: {
        id: meetingId,
        workspaceId,
      },
    });

    if (!meeting) {
      return Response.json(
        { error: "Meeting not found or access denied" },
        { status: 404 }
      );
    }

    // Update meeting status to PROCESSING (if not already)
    if (meeting.status !== "PROCESSING") {
      await db.meeting.update({
        where: { id: meetingId },
        data: { status: "PROCESSING" },
      });
    }

    try {
      // Step 1: Get signed URL for audio file
      // fileUrl is stored as S3 key (e.g., "workspaces/{workspaceId}/meetings/{meetingId}/recording.mp4")
      // We need to generate a signed URL for transcription service to access it
      const audioUrl = await getSignedFileUrl(fileUrl, 3600); // 1 hour expiry

      // Step 2: Transcribe audio
      console.log(`Transcribing meeting ${meetingId}...`);
      const transcriptionResult = await transcribeAudio(audioUrl, {
        language: "en-US",
        speakerDiarization: true,
        punctuate: true,
      });

      // Step 3: Store transcript in database
      // Convert transcript to JSON-serializable format
      const transcriptJson = {
        segments: transcriptionResult.transcript.segments,
        duration: transcriptionResult.transcript.duration,
      };

      await db.meeting.update({
        where: { id: meetingId },
        data: {
          transcript: transcriptJson as any, // Prisma JSON type
          status: "DRAFT_READY", // Extraction will be added in EPIC 3
          draftReadyAt: new Date(),
        },
      });

      // Step 4: Log transcription completion
      await db.auditEvent.create({
        data: {
          workspaceId,
          userId: "system", // System user for automated processes
          action: "UPLOAD", // Using UPLOAD for now, can add TRANSCRIBE action later
          resourceType: "meeting",
          resourceId: meetingId,
          metadata: {
            action: "transcription_complete",
            status: "DRAFT_READY",
            provider: transcriptionResult.provider,
            processingTime: transcriptionResult.processingTime,
            segmentCount: transcriptionResult.transcript.segments.length,
          },
        },
      });

      // Step 5: Send email notification (async, don't block on failure)
      try {
        // Get the user who uploaded the meeting (from audit events)
        const uploadEvent = await db.auditEvent.findFirst({
          where: {
            workspaceId,
            resourceId: meetingId,
            action: "UPLOAD",
          },
          orderBy: {
            timestamp: "desc",
          },
        });

        if (uploadEvent && uploadEvent.userId && uploadEvent.userId !== "system") {
          const user = await db.user.findUnique({
            where: { id: uploadEvent.userId },
          });

          if (user?.email) {
            // Send email asynchronously (don't await - failures shouldn't block workflow)
            sendDraftReadyEmail({
              email: user.email,
              clientName: meeting.clientName,
              meetingDate: meeting.meetingDate,
              meetingId: meeting.id,
            }).catch((error) => {
              console.error("Failed to send draft ready email:", error);
              // Log email failure but don't throw
            });
          }
        }
      } catch (emailError) {
        console.error("Error sending draft ready email:", emailError);
        // Don't fail the job if email fails
      }

      console.log(`Transcription complete for meeting ${meetingId}`);

      return Response.json({
        success: true,
        meetingId,
        status: "DRAFT_READY",
      });
    } catch (transcriptionError) {
      // Handle transcription errors
      console.error(`Transcription failed for meeting ${meetingId}:`, transcriptionError);

      // Update meeting status to show error (we'll need to add an ERROR status or store in metadata)
      await db.meeting.update({
        where: { id: meetingId },
        data: {
          status: "PROCESSING", // Keep as PROCESSING for now, can add ERROR status later
          // Store error in transcript field for now (temporary)
          transcript: {
            error: true,
            message: transcriptionError instanceof Error ? transcriptionError.message : "Transcription failed",
          },
        },
      });

      // Log transcription failure
      await db.auditEvent.create({
        data: {
          workspaceId,
          userId: "system",
          action: "UPLOAD",
          resourceType: "meeting",
          resourceId: meetingId,
          metadata: {
            action: "transcription_failed",
            error: transcriptionError instanceof Error ? transcriptionError.message : "Unknown error",
          },
        },
      });

      // Return error but don't throw (QStash will retry)
      return Response.json(
        {
          success: false,
          error: "Transcription failed",
          message: transcriptionError instanceof Error ? transcriptionError.message : "Unknown error",
        },
        { status: 500 }
      );
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ error: error.errors }, { status: 400 });
    }
    console.error("Error processing meeting:", error);
    return Response.json(
      { error: "Failed to process meeting" },
      { status: 500 }
    );
  }
}

// Verify QStash signature in production
export const POST = process.env.NODE_ENV === "production"
  ? verifySignatureAppRouter(handler)
  : handler;


