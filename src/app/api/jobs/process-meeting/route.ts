import { db } from "~/server/db";
import { verifySignatureAppRouter } from "@upstash/qstash/nextjs";
import { z } from "zod";
import { transcribeAudio } from "~/server/transcription";
import { getSignedFileUrl } from "~/server/storage";
import { sendDraftReadyEmail } from "~/server/email";
import { extractFields } from "~/server/extraction";
import { toExtractionData, validateEvidenceCoverage } from "~/server/extraction/evidence";
import { generateSearchableText } from "~/server/search/index";
import { createErrorResponse, AppError, ErrorMessages } from "~/server/errors";
import type { Transcript } from "~/server/transcription/types";

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
  const startTime = Date.now();
  console.log(`🔔 QStash webhook received at ${new Date().toISOString()}`);
  console.log(`📋 Request headers:`, Object.fromEntries(request.headers.entries()));
  
  try {
    // Parse request body with error handling
    let body: any;
    try {
      body = await request.json();
      console.log(`📦 Request body parsed:`, { 
        meetingId: body.meetingId, 
        workspaceId: body.workspaceId,
        fileUrl: body.fileUrl ? body.fileUrl.substring(0, 50) + "..." : "missing"
      });
    } catch (parseError) {
      console.error("❌ Failed to parse request body:", parseError);
      return Response.json(
        { error: "Invalid request body", details: parseError instanceof Error ? parseError.message : "Unknown error" },
        { status: 400 }
      );
    }
    
    // Validate request body
    let validatedData: { meetingId: string; workspaceId: string; fileUrl: string };
    try {
      validatedData = processMeetingSchema.parse(body);
      console.log(`✅ Request validated for meeting ${validatedData.meetingId}`);
    } catch (validationError) {
      console.error("❌ Request validation failed:", validationError);
      if (validationError instanceof z.ZodError) {
        return Response.json(
          { error: "Validation failed", details: validationError.errors },
          { status: 400 }
        );
      }
      throw validationError;
    }
    
    const { meetingId, workspaceId, fileUrl } = validatedData;

    // Verify meeting exists and belongs to workspace
    let meeting;
    try {
      meeting = await db.meeting.findFirst({
        where: {
          id: meetingId,
          workspaceId,
        },
      });
    } catch (dbError) {
      console.error("❌ Database error fetching meeting:", dbError);
      return Response.json(
        { error: "Database error", details: dbError instanceof Error ? dbError.message : "Unknown error" },
        { status: 500 }
      );
    }

    if (!meeting) {
      console.error(`❌ Meeting not found: ${meetingId} in workspace ${workspaceId}`);
      return Response.json(
        { error: "Meeting not found or access denied" },
        { status: 404 }
      );
    }
    
    console.log(`📄 Meeting found: ${meeting.id}, status: ${meeting.status}, fileUrl: ${meeting.fileUrl ? "exists" : "missing"}`);

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
      console.log(`🔗 Generating signed URL for file: ${fileUrl.substring(0, 50)}...`);
      let audioUrl: string;
      try {
        audioUrl = await getSignedFileUrl(fileUrl, 3600); // 1 hour expiry
        console.log(`✅ Signed URL generated (length: ${audioUrl.length})`);
      } catch (s3Error) {
        console.error("❌ Failed to generate signed URL:", s3Error);
        throw new Error(`S3 error: ${s3Error instanceof Error ? s3Error.message : "Unknown error"}`);
      }

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

      // Update meeting with transcript (but keep status as PROCESSING until extraction completes)
      await db.meeting.update({
        where: { id: meetingId },
        data: {
          transcript: transcriptJson as any, // Prisma JSON type
          // Status stays PROCESSING until extraction completes
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
            provider: transcriptionResult.provider,
            processingTime: transcriptionResult.processingTime,
            segmentCount: transcriptionResult.transcript.segments.length,
          },
        },
      });

      // Step 5: Extract structured fields using LLM
      console.log(`Extracting fields from transcript for meeting ${meetingId}...`);
      const extractionResult = await extractFields(transcriptionResult.transcript);

      // Step 6: Create evidence map and validate coverage
      const extractionData = toExtractionData(extractionResult, transcriptionResult.transcript);
      const evidenceValidation = validateEvidenceCoverage(extractionData.evidenceMap);

      if (!evidenceValidation.valid) {
        console.warn(
          `⚠️ Evidence coverage below 90% for meeting ${meetingId}: ${(evidenceValidation.coverage * 100).toFixed(1)}% (${evidenceValidation.validClaims}/${evidenceValidation.totalClaims} valid claims)`
        );
      } else {
        console.log(
          `✅ Evidence coverage: ${(evidenceValidation.coverage * 100).toFixed(1)}% (${evidenceValidation.validClaims}/${evidenceValidation.totalClaims} valid claims)`
        );
      }

      // Step 7: Generate searchable text for indexing
      const searchableText = generateSearchableText(
        transcriptionResult.transcript,
        extractionData
      );

      // Step 8: Store extraction data, searchable text, and update status to DRAFT_READY
      await db.meeting.update({
        where: { id: meetingId },
        data: {
          extraction: extractionData as any, // Prisma JSON type
          searchableText, // Indexed text for fast keyword search
          status: "DRAFT_READY",
          draftReadyAt: new Date(),
        },
      });

      // Step 9: Log extraction completion
      await db.auditEvent.create({
        data: {
          workspaceId,
          userId: "system",
          action: "UPLOAD",
          resourceType: "meeting",
          resourceId: meetingId,
          metadata: {
            action: "extraction_complete",
            status: "DRAFT_READY",
            provider: extractionResult.provider,
            processingTime: extractionResult.processingTime,
            topicsCount: extractionData.topics.length,
            recommendationsCount: extractionData.recommendations.length,
            disclosuresCount: extractionData.disclosures.length,
            decisionsCount: extractionData.decisions.length,
            followUpsCount: extractionData.followUps.length,
            evidenceCoverage: evidenceValidation.coverage,
            evidenceValid: evidenceValidation.valid,
          },
        },
      });

      // Step 10: Send email notification (async, don't block on failure)
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

      console.log(`✅ Processing complete for meeting ${meetingId} (transcription + extraction)`);

      return Response.json({
        success: true,
        meetingId,
        status: "DRAFT_READY",
        extraction: {
          topicsCount: extractionData.topics.length,
          recommendationsCount: extractionData.recommendations.length,
          disclosuresCount: extractionData.disclosures.length,
          decisionsCount: extractionData.decisions.length,
          followUpsCount: extractionData.followUps.length,
          evidenceCoverage: evidenceValidation.coverage,
        },
      });
    } catch (processingError) {
      // Handle transcription or extraction errors
      const isTranscriptionError = !meeting.transcript;
      const errorMessage = processingError instanceof Error ? processingError.message : "Unknown error";
      
      console.error(`${isTranscriptionError ? "Transcription" : "Extraction"} failed for meeting ${meetingId}:`, processingError);

      // Update meeting status to show error (we'll need to add an ERROR status or store in metadata)
      await db.meeting.update({
        where: { id: meetingId },
        data: {
          status: "PROCESSING", // Keep as PROCESSING for now, can add ERROR status later
          // Store error in appropriate field
          ...(isTranscriptionError
            ? {
                transcript: {
                  error: true,
                  message: errorMessage,
                },
              }
            : {
                extraction: {
                  error: true,
                  message: errorMessage,
                },
              }),
        },
      });

      // Log failure
      await db.auditEvent.create({
        data: {
          workspaceId,
          userId: "system",
          action: "UPLOAD",
          resourceType: "meeting",
          resourceId: meetingId,
          metadata: {
            action: isTranscriptionError ? "transcription_failed" : "extraction_failed",
            error: errorMessage,
          },
        },
      });

      // Return error but don't throw (QStash will retry)
      return Response.json(
        {
          success: false,
          error: isTranscriptionError ? "Transcription failed" : "Extraction failed",
          message: errorMessage,
        },
        { status: 500 }
      );
    }
  } catch (error) {
    const elapsed = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const errorStack = error instanceof Error ? error.stack : undefined;
    const errorName = error instanceof Error ? error.name : "UnknownError";
    
    console.error("❌ CRITICAL ERROR in process-meeting handler:", {
      error: errorMessage,
      name: errorName,
      stack: errorStack,
      elapsed: `${elapsed}ms`,
    });
    
    // Handle validation errors separately
    if (error instanceof z.ZodError) {
      console.error("❌ Validation error:", error.errors);
      return Response.json({ 
        error: "Validation failed", 
        details: error.errors 
      }, { status: 400 });
    }
    
    // Try to get meeting context from request body for error logging
    let meetingId: string | undefined;
    let workspaceId: string | undefined;
    
    try {
      // Try to read body from request (may have already been consumed)
      const bodyText = await request.clone().text().catch(() => "");
      if (bodyText) {
        const body = JSON.parse(bodyText);
        meetingId = body.meetingId;
        workspaceId = body.workspaceId;
      }
    } catch {
      // Ignore errors reading body - it may have already been consumed
      console.warn("⚠️ Could not read request body for error logging");
    }
    
    // Log error to audit events if we have meeting context
    if (meetingId && workspaceId) {
      try {
        await db.auditEvent.create({
          data: {
            workspaceId,
            userId: "system",
            action: "UPLOAD",
            resourceType: "meeting",
            resourceId: meetingId,
            meetingId,
            metadata: {
              action: "processing_error",
              error: errorMessage,
              errorName,
              elapsed,
              timestamp: new Date().toISOString(),
            },
          },
        });
        console.log("✅ Error logged to audit events");
      } catch (auditError) {
        console.error("❌ Failed to log error to audit events:", auditError);
      }
    }
    
    // Return detailed error response for debugging
    return Response.json(
      { 
        error: "Failed to process meeting",
        message: errorMessage,
        errorName,
        elapsed: `${elapsed}ms`,
        // Only include stack in development
        ...(process.env.NODE_ENV !== "production" && errorStack ? { stack: errorStack } : {}),
      },
      { status: 500 }
    );
  }
}

// Verify QStash signature in production
// Note: If signature verification fails, requests will be rejected with 401
// Make sure QSTASH_CURRENT_SIGNING_KEY and QSTASH_NEXT_SIGNING_KEY are set in production
export const POST = (() => {
  const isProduction = process.env.NODE_ENV === "production";
  const hasSigningKeys = !!(process.env.QSTASH_CURRENT_SIGNING_KEY || process.env.QSTASH_NEXT_SIGNING_KEY);
  
  console.log(`🔧 QStash handler setup:`, {
    isProduction,
    hasSigningKeys,
    currentKey: !!process.env.QSTASH_CURRENT_SIGNING_KEY,
    nextKey: !!process.env.QSTASH_NEXT_SIGNING_KEY,
  });
  
  if (isProduction) {
    // In production, verify signature
    if (!hasSigningKeys) {
      console.warn("⚠️ WARNING: QStash signing keys not set in production. Webhook requests may be rejected.");
      console.warn("   Set QSTASH_CURRENT_SIGNING_KEY and QSTASH_NEXT_SIGNING_KEY in Vercel environment variables.");
      console.warn("   Get them from: https://console.upstash.com/qstash");
      // Still try to use verification - it might work with just the token
    }
    
    try {
      const verifiedHandler = verifySignatureAppRouter(handler);
      console.log("✅ QStash signature verification enabled");
      return verifiedHandler;
    } catch (error) {
      console.error("❌ Error setting up QStash signature verification:", error);
      console.error("   Falling back to handler without verification");
      // Fall back to handler without verification if setup fails
      return handler;
    }
  }
  
  // In development, skip signature verification
  console.log("🔧 Development mode: QStash signature verification disabled");
  return handler;
})();


