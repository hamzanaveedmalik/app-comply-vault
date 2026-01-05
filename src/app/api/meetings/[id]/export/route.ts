import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { generateAuditPack, generateExportFilename } from "~/server/export";
import type { ExtractionData } from "~/server/extraction/types";
import type { TranscriptSegment } from "~/server/transcription/types";

// Force Node.js runtime for this route (needed for Buffer and archiver)
export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.workspaceId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

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

    // Get workspace
    const workspace = await db.workspace.findUnique({
      where: { id: session.user.workspaceId },
    });

    if (!workspace) {
      return Response.json({ error: "Workspace not found" }, { status: 404 });
    }

    // Get version history
    const versions = await db.version.findMany({
      where: {
        meetingId: meeting.id,
      },
      orderBy: {
        timestamp: "asc",
      },
    });

    // Generate audit pack
    const zipBuffer = await generateAuditPack({
      meeting: {
        ...meeting,
        finalizedBy: finalizedByUser,
      },
      extraction,
      transcript,
      versions,
      workspace,
    });

    // Generate filename
    const filename = generateExportFilename(workspace.name, meeting.clientName);

    // Log export event
    await db.auditEvent.create({
      data: {
        workspaceId: session.user.workspaceId,
        userId: session.user.id,
        action: "EXPORT",
        resourceType: "meeting",
        resourceId: meeting.id,
        metadata: {
          exportFormat: "audit_pack_zip",
          filename,
          exportedAt: new Date().toISOString(),
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
    return Response.json(
      { error: "Failed to export audit pack" },
      { status: 500 }
    );
  }
}

