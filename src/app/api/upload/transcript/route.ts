import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { z } from "zod";
import { parseTranscriptText } from "~/server/transcription/txt";
import { extractFields } from "~/server/extraction";
import { toExtractionData, validateEvidenceCoverage } from "~/server/extraction/evidence";
import { generateSearchableText } from "~/server/search/index";
import { detectMissingDisclosureFlags } from "~/server/flags";

const transcriptUploadSchema = z.object({
  clientName: z.string().min(1, "Client name is required"),
  meetingType: z.string().min(1, "Meeting type is required"),
  meetingDate: z.string().datetime("Meeting date must be a valid ISO datetime"),
  consent: z.boolean().refine((val) => val === true, {
    message: "You must confirm you have permission to upload this recording",
  }),
  transcriptText: z.string().min(1, "Transcript text is required"),
  fileName: z.string().optional(),
});

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.workspaceId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validation = transcriptUploadSchema.parse(body);

    const transcript = parseTranscriptText(validation.transcriptText);
    if (!transcript.segments.length) {
      return Response.json(
        { error: "Transcript does not contain any recognizable speaker segments" },
        { status: 400 }
      );
    }

    const meeting = await db.meeting.create({
      data: {
        workspaceId: session.user.workspaceId,
        clientName: validation.clientName,
        meetingType: validation.meetingType,
        meetingDate: new Date(validation.meetingDate),
        status: "PROCESSING",
        transcript: transcript as any,
        sourceFileName: validation.fileName ?? "transcript.txt",
        sourceFileMime: "text/plain",
        sourceUploadedAt: new Date(),
      },
    });

    await db.auditEvent.create({
      data: {
        workspaceId: session.user.workspaceId,
        userId: session.user.id,
        action: "UPLOAD",
        resourceType: "meeting",
        resourceId: meeting.id,
        meetingId: meeting.id,
        metadata: {
          action: "transcript_upload",
          fileName: validation.fileName ?? "transcript.txt",
          segmentCount: transcript.segments.length,
        },
      },
    });

    const extractionResult = await extractFields(transcript);
    const extractionData = toExtractionData(extractionResult, transcript);
    const evidenceValidation = validateEvidenceCoverage(extractionData.evidenceMap);
    const searchableText = generateSearchableText(transcript, extractionData);

    await db.meeting.update({
      where: { id: meeting.id },
      data: {
        extraction: extractionData as any,
        searchableText,
        status: "DRAFT_READY",
        draftReadyAt: new Date(),
      },
    });

    const missingDisclosureFlags = detectMissingDisclosureFlags(extractionData);
    if (missingDisclosureFlags.length > 0) {
      const workspaceId = session.user.workspaceId!;
      await db.flag.createMany({
        data: missingDisclosureFlags.map((flag) => ({
          workspaceId,
          meetingId: meeting.id,
          type: flag.type,
          severity: flag.severity,
          status: "OPEN",
          evidence: flag.evidence as any,
          createdByType: "SYSTEM",
        })),
      });
    }

    await db.auditEvent.create({
      data: {
        workspaceId: session.user.workspaceId,
        userId: session.user.id,
        action: "UPLOAD",
        resourceType: "meeting",
        resourceId: meeting.id,
        meetingId: meeting.id,
        metadata: {
          action: "extraction_complete_from_transcript",
          provider: extractionResult.provider,
          processingTime: extractionResult.processingTime,
          evidenceCoverage: evidenceValidation.coverage,
          evidenceValid: evidenceValidation.valid,
        },
      },
    });

    return Response.json({
      meetingId: meeting.id,
      status: "DRAFT_READY",
    });
  } catch (error) {
    console.error("Error uploading transcript:", error);
    if (error instanceof z.ZodError) {
      return Response.json({ error: "Invalid request data", details: error.errors }, { status: 400 });
    }
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to upload transcript" },
      { status: 500 }
    );
  }
}
