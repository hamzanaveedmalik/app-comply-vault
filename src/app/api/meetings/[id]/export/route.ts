import { requireAppAccess } from "~/server/auth/guards";
import { db } from "~/server/db";
import { generateAuditPack, generateExportFilename } from "~/server/export";
import type { ExtractionData } from "~/server/extraction/types";
import type { TranscriptSegment } from "~/server/transcription/types";
import type { Meeting, User } from "~/server/export/types";
import { resolveExportWatermark } from "~/server/export/watermark";
import { isEmailIntelligenceEnabled } from "~/lib/feature-flags";
import {
  buildEmailCorrespondenceSection,
  emailCorrespondenceSectionToCsv,
} from "~/server/export/email-correspondence-section";

// Force Node.js runtime for this route (needed for Buffer, archiver, PDFKit)
export const runtime = "nodejs";
// PDF + ZIP generation can take 10-30s; allow up to 60s
export const maxDuration = 60;

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

    const [advisorCertifiedByUser, cmReviewedByUser, ccoSignedOffByUser] = await Promise.all([
      meeting.advisorCertifiedByUserId
        ? db.user.findUnique({ where: { id: meeting.advisorCertifiedByUserId } })
        : null,
      meeting.cmReviewedByUserId
        ? db.user.findUnique({ where: { id: meeting.cmReviewedByUserId } })
        : null,
      meeting.ccoSignedOffByUserId
        ? db.user.findUnique({ where: { id: meeting.ccoSignedOffByUserId } })
        : null,
    ]);

const EXPORTABLE_MEETING_STATUSES = new Set([
  "FINALIZED",
  "CCO_SIGNED_OFF",
  "CM_REVIEWED",
  "ADVISOR_CERTIFIED",
  "DRAFT_READY",
  "DRAFT",
]);

    // Check if meeting is in an exportable state
    if (!EXPORTABLE_MEETING_STATUSES.has(meeting.status)) {
      return Response.json(
        { error: "Meeting is not in an exportable status yet" },
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

    // Manual export is a draft/convenience download — watermark per entitlement (CV-TR-19).
    // Sealed packs use purpose "seal" and are never watermarked.
    const watermarked = resolveExportWatermark({
      purpose: "draft",
      workspace: {
        billingStatus: workspace.billingStatus,
        planTier: workspace.planTier,
        trialEndsAt: workspace.trialEndsAt,
      },
    });

    // Get flags for this meeting
    const flagsRaw = await db.flag.findMany({
      where: { meetingId: meeting.id },
    });
    const flags = flagsRaw.map((f) => ({
      type: f.type,
      severity: f.severity,
      status: f.status,
      evidence: f.evidence,
    }));

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
      advisorCertifiedByUser: advisorCertifiedByUser ?? undefined,
      cmReviewedByUser: cmReviewedByUser ?? undefined,
      ccoSignedOffByUser: ccoSignedOffByUser ?? undefined,
    } as Meeting & { finalizedBy?: User | null };

    const sessionUser = session?.user;
    const exportingUserName =
      (sessionUser as { name?: string })?.name ??
      (sessionUser as { email?: string })?.email ??
      "System";

    let emailCorrespondenceCsv: string | null = null;
    if (isEmailIntelligenceEnabled() && meeting.clientId) {
      const rangeTo = meeting.meetingDate;
      const rangeFrom = new Date(rangeTo.getTime() - 365 * 24 * 60 * 60 * 1000);
      const section = await buildEmailCorrespondenceSection({
        workspaceId,
        clientId: meeting.clientId,
        from: rangeFrom,
        to: rangeTo,
      });
      if (section && section.rows.length > 0) {
        emailCorrespondenceCsv = emailCorrespondenceSectionToCsv(section);
      }
    }

    const zipBuffer = await generateAuditPack({
      meeting: meetingForExport,
      extraction,
      transcript,
      versions,
      workspace,
      flags,
      watermarked,
      exportingUserName,
      emailCorrespondenceCsv,
    });

    // Generate filename
    const filename = generateExportFilename(workspace.name, meeting.clientName, {
      watermarked,
      date: meeting.meetingDate,
    });

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
    // Include error details in staging/preview for debugging
    const isPreview =
      process.env.NODE_ENV === "development" ||
      process.env.VERCEL_ENV === "preview" ||
      process.env.VERCEL_ENV === "development";
    return Response.json(
      {
        error: "Failed to export audit pack",
        details: isPreview ? errorMessage : undefined,
        stack: isPreview ? errorStack : undefined,
      },
      { status: 500 }
    );
  }
}

