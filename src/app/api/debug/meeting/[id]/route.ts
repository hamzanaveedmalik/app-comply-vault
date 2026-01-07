import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { NextResponse } from "next/server";

/**
 * Debug endpoint to check meeting status and diagnose processing issues
 */
export async function GET(
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

    // Get meeting details
    const meeting = await db.meeting.findFirst({
      where: {
        id: id,
        workspaceId,
      },
      include: {
        versions: {
          take: 5,
          orderBy: { timestamp: "desc" },
        },
      },
    });

    if (!meeting) {
      return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
    }

    // Get recent audit events for this meeting
    const auditEvents = await db.auditEvent.findMany({
      where: {
        workspaceId,
        meetingId: id,
      },
      orderBy: {
        timestamp: "desc",
      },
      take: 20,
    });

    // Check for QStash-related issues
    // Look for upload_completed event OR check if status was updated to PROCESSING after upload
    const uploadCompleteEvent = auditEvents.find(
      (e) => {
        const metadata = e.metadata as { action?: string } | null;
        return metadata?.action === "upload_completed" || metadata?.action === "upload_initiated";
      }
    );
    
    // Also check if meeting status is PROCESSING (which indicates upload completed)
    const uploadCompleted = !!uploadCompleteEvent || meeting.status === "PROCESSING" || meeting.status === "DRAFT_READY" || meeting.status === "DRAFT" || meeting.status === "FINALIZED";
    const transcriptionCompleteEvent = auditEvents.find(
      (e) => e.metadata && typeof e.metadata === "object" && "action" in e.metadata && e.metadata.action === "transcription_complete"
    );
    const extractionCompleteEvent = auditEvents.find(
      (e) => e.metadata && typeof e.metadata === "object" && "action" in e.metadata && e.metadata.action === "extraction_complete"
    );
    const errorEvents = auditEvents.filter(
      (e) => e.metadata && typeof e.metadata === "object" && ("action" in e.metadata && (e.metadata.action === "transcription_failed" || e.metadata.action === "extraction_failed"))
    );

    // Check environment variables
    const env = {
      QSTASH_TOKEN: !!process.env.QSTASH_TOKEN,
      NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || "NOT SET",
      TRANSCRIPTION_PROVIDER: process.env.TRANSCRIPTION_PROVIDER || "NOT SET",
      EXTRACTION_PROVIDER: process.env.EXTRACTION_PROVIDER || "NOT SET",
      DEEPGRAM_API_KEY: !!process.env.DEEPGRAM_API_KEY,
      ASSEMBLYAI_API_KEY: !!process.env.ASSEMBLYAI_API_KEY,
      OPENAI_API_KEY: !!process.env.OPENAI_API_KEY,
      ANTHROPIC_API_KEY: !!process.env.ANTHROPIC_API_KEY,
    };

    // Diagnose the issue
    const diagnosis = {
      status: meeting.status,
      hasFile: !!meeting.fileUrl,
      hasTranscript: !!meeting.transcript,
      hasExtraction: !!meeting.extraction,
      uploadComplete: uploadCompleted,
      transcriptionComplete: !!transcriptionCompleteEvent,
      extractionComplete: !!extractionCompleteEvent,
      hasErrors: errorEvents.length > 0,
      errors: errorEvents.map((e) => ({
        timestamp: e.timestamp,
        action: e.metadata && typeof e.metadata === "object" && "action" in e.metadata ? e.metadata.action : "unknown",
        error: e.metadata && typeof e.metadata === "object" && "error" in e.metadata ? e.metadata.error : "unknown",
      })),
      stuckReason: null as string | null,
    };

    // Determine why it's stuck
    if (meeting.status === "PROCESSING") {
      if (!uploadCompleted) {
        diagnosis.stuckReason = "Upload never completed - QStash job may not have been published. Try clicking 'Retry Processing'.";
      } else if (!transcriptionCompleteEvent && !errorEvents.some((e) => {
        const metadata = e.metadata as { action?: string } | null;
        return metadata?.action === "transcription_failed";
      })) {
        diagnosis.stuckReason = "Transcription not started or still in progress - check transcription service";
      } else if (transcriptionCompleteEvent && !extractionCompleteEvent && !errorEvents.some((e) => {
        const metadata = e.metadata as { action?: string } | null;
        return metadata?.action === "extraction_failed";
      })) {
        diagnosis.stuckReason = "Extraction not started or still in progress - check extraction service";
      } else if (errorEvents.length > 0) {
        diagnosis.stuckReason = `Processing failed: ${errorEvents[0]?.metadata && typeof errorEvents[0].metadata === "object" && "error" in errorEvents[0].metadata ? errorEvents[0].metadata.error : "Unknown error"}`;
      }
    }

    return NextResponse.json({
      meeting: {
        id: meeting.id,
        status: meeting.status,
        clientName: meeting.clientName,
        meetingDate: meeting.meetingDate,
        fileUrl: meeting.fileUrl,
        createdAt: meeting.createdAt,
        updatedAt: meeting.updatedAt,
        draftReadyAt: meeting.draftReadyAt,
      },
      diagnosis,
      auditEvents: auditEvents.map((e) => ({
        id: e.id,
        action: e.action,
        timestamp: e.timestamp,
        metadata: e.metadata,
      })),
      environment: env,
      recommendations: getRecommendations(diagnosis, env),
    });
  } catch (error) {
    console.error("Debug error:", error);
    return NextResponse.json(
      { error: "Failed to debug meeting", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

function getRecommendations(diagnosis: any, env: any): string[] {
  const recommendations: string[] = [];

  if (!env.QSTASH_TOKEN) {
    recommendations.push("❌ QSTASH_TOKEN is not set - jobs cannot be published");
  }

  if (!env.NEXT_PUBLIC_APP_URL || env.NEXT_PUBLIC_APP_URL === "NOT SET") {
    recommendations.push("❌ NEXT_PUBLIC_APP_URL is not set - QStash cannot reach your webhook");
  } else if (env.NEXT_PUBLIC_APP_URL.includes("localhost")) {
    recommendations.push("❌ NEXT_PUBLIC_APP_URL is set to localhost - QStash cannot reach localhost URLs");
  }

  if (diagnosis.stuckReason) {
    recommendations.push(`⚠️ Issue: ${diagnosis.stuckReason}`);
  }

  if (diagnosis.status === "PROCESSING" && !diagnosis.transcriptionComplete) {
    if (env.TRANSCRIPTION_PROVIDER === "NOT SET") {
      recommendations.push("❌ TRANSCRIPTION_PROVIDER is not set");
    } else if (env.TRANSCRIPTION_PROVIDER === "deepgram" && !env.DEEPGRAM_API_KEY) {
      recommendations.push("❌ DEEPGRAM_API_KEY is not set");
    } else if (env.TRANSCRIPTION_PROVIDER === "assemblyai" && !env.ASSEMBLYAI_API_KEY) {
      recommendations.push("❌ ASSEMBLYAI_API_KEY is not set");
    }
  }

  if (diagnosis.transcriptionComplete && !diagnosis.extractionComplete) {
    if (env.EXTRACTION_PROVIDER === "NOT SET") {
      recommendations.push("❌ EXTRACTION_PROVIDER is not set - set to 'openai' or 'anthropic' in Vercel environment variables");
    } else if (env.EXTRACTION_PROVIDER === "openai" && !env.OPENAI_API_KEY) {
      recommendations.push("❌ OPENAI_API_KEY is not set - get it from https://platform.openai.com/api-keys");
    } else if (env.EXTRACTION_PROVIDER === "anthropic" && !env.ANTHROPIC_API_KEY) {
      recommendations.push("❌ ANTHROPIC_API_KEY is not set - get it from https://console.anthropic.com");
    }
  }
  
  // Always check EXTRACTION_PROVIDER if it's missing (even before transcription completes)
  if (env.EXTRACTION_PROVIDER === "NOT SET") {
    recommendations.push("⚠️ EXTRACTION_PROVIDER is not set - extraction will fail. Set it to 'openai' or 'anthropic' in Vercel.");
  }

  if (diagnosis.hasErrors) {
    recommendations.push("💡 Check Vercel function logs for detailed error messages");
    recommendations.push("💡 You can manually retry processing using the retry endpoint");
  }

  if (recommendations.length === 0) {
    recommendations.push("✅ All checks passed - issue may be temporary, check Vercel logs");
  }

  return recommendations;
}

