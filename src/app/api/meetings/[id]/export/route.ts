import { requireAppAccess } from "~/server/auth/guards";
import { db } from "~/server/db";
import { generateAuditPack, generateExportFilename } from "~/server/export";
import type { ExtractionData } from "~/server/extraction/types";
import type { TranscriptSegment } from "~/server/transcription/types";
import type { Meeting, User } from "~/server/export/types";
import { getEntitlements, isTrialExpired } from "~/server/billing/entitlements";

// Force Node.js runtime for this route (needed for Buffer and archiver)
export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const access = await requireAppAccess();
    if (!access.ok) {
      return Response.json({ error: access.error }, { status: access.status });
    }
    // TypeScript narrowing: access.ok === true means we have session and workspaceId
    const session = access.session;
    const workspaceId = access.workspaceId;

    const { id } = await params;

    // Find the meeting
    const meeting = await db.meeting.findFirst({
      where: {
        id,
        workspaceId: workspaceId,
      },
    });

    if (!meeting) {
      return Response.json({ error: "Meeting not found" }, { status: 404 });
    }

    // Fetch finalizedBy user if exists
    let finalizedByUser = null;
    if (meeting.finalizedBy) {
      finalizedByUser = await db.user.findUnique({
        where: { id: meeting.finalizedBy },
      });
    }

    // Check if meeting is finalized (or allow export for DRAFT_READY meetings)
    if (meeting.status !== "FINALIZED" && meeting.status !== "DRAFT_READY") {
      return Response.json(
        { error: "Meeting must be finalized or draft ready to export" },
        { status: 400 }
      );
    }

    // Get extraction data
    const extraction = meeting.extraction as ExtractionData | null;
    if (!extraction) {
      return Response.json(
        { error: "Meeting does not have extraction data. Please reprocess the meeting." },
        { status: 400 }
      );
    }

    // Validate extraction data structure
    if (!extraction.evidenceMap) {
      console.warn("Extraction data missing evidenceMap, initializing empty array");
      extraction.evidenceMap = [];
    }
    if (!extraction.topics) {
      extraction.topics = [];
    }
    if (!extraction.recommendations) {
      extraction.recommendations = [];
    }
    if (!extraction.disclosures) {
      extraction.disclosures = [];
    }
    if (!extraction.decisions) {
      extraction.decisions = [];
    }
    if (!extraction.followUps) {
      extraction.followUps = [];
    }

    // Get transcript
    const transcript = meeting.transcript as
      | { segments: TranscriptSegment[] }
      | null
      | undefined;

    if (!transcript || !transcript.segments) {
      return Response.json(
        { error: "Meeting does not have a transcript" },
        { status: 400 }
      );
    }

    // Get workspace for export metadata
    // Note: requireAppAccess already validates workspace exists and user has access
    const workspace = await db.workspace.findUnique({
      where: { id: workspaceId },
    });

    if (!workspace) {
      return Response.json({ error: "Workspace not found" }, { status: 404 });
    }

    // Determine if export should be watermarked
    // requireAppAccess already ensures workspace is active/trialing, so we only need to check for watermarking
    const trialExpired =
      workspace.billingStatus === "TRIALING" && isTrialExpired(workspace.trialEndsAt);
    const entitlements = getEntitlements({
      billingStatus: workspace.billingStatus,
      planTier: workspace.planTier,
      trialEndsAt: workspace.trialEndsAt,
    });
    // getEntitlements always returns a value (fallback to ENTITLEMENTS.FREE)
    const watermarked = (entitlements?.exportsWatermarked ?? false) || trialExpired;

    // Get version history
    const versionsRaw = await db.version.findMany({
      where: {
        meetingId: meeting.id,
      },
      orderBy: {
        timestamp: "asc",
      },
    });

    // Cast versions to our type definition
    const versions = versionsRaw.map((v) => ({
      id: v.id,
      meetingId: v.meetingId,
      version: v.version,
      editorId: v.editorId,
      whatChanged: v.whatChanged,
      reason: v.reason,
      timestamp: v.timestamp,
    }));

    // Generate audit pack
    // Exclude finalizedBy from meeting and add it as User object
    // Type assertion needed because Meeting.finalizedBy is string | null, but export expects User | null
    const { finalizedBy: _, ...meetingWithoutFinalizedBy } = meeting;
    const meetingForExport = {
      ...meetingWithoutFinalizedBy,
      finalizedBy: finalizedByUser,
    } as Meeting & { finalizedBy?: User | null };

    const zipBuffer = await generateAuditPack({
      meeting: meetingForExport,
      extraction,
      transcript,
      versions,
      workspace,
      watermarked,
    });

    // Generate filename
    const filename = generateExportFilename(workspace.name, meeting.clientName, { watermarked });

    // Log export event
    // requireAppAccess ensures session exists and has user
    // Type assertion needed because TypeScript doesn't narrow the union type properly
    const userId = (session as { user?: { id?: string } })?.user?.id;
    if (!userId) {
      return Response.json({ error: "User ID not found in session" }, { status: 401 });
    }

    await db.auditEvent.create({
      data: {
        workspaceId: workspaceId,
        userId: userId,
        action: "EXPORT",
        resourceType: "meeting",
        resourceId: meeting.id,
        metadata: {
          exportFormat: "audit_pack_zip",
          filename,
          exportedAt: new Date().toISOString(),
          watermarked,
          billingStatus: workspace.billingStatus,
          planTier: workspace.planTier,
        },
      },
    });

    // Return ZIP file
    // Convert Buffer to Uint8Array for Edge Runtime compatibility
    const uint8Array = new Uint8Array(zipBuffer);

    return new Response(uint8Array, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": zipBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error("Error exporting audit pack:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const errorStack = error instanceof Error ? error.stack : undefined;
    console.error("Error details:", {
      message: errorMessage,
      stack: errorStack,
      name: error instanceof Error ? error.name : undefined,
    });
    return Response.json(
      {
        error: "Failed to export audit pack",
        details: process.env.NODE_ENV === "development" ? errorMessage : undefined,
        stack: process.env.NODE_ENV === "development" ? errorStack : undefined,
      },
      { status: 500 }
    );
  }
}

