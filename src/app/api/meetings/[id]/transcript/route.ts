import { requireAppAccess } from "~/server/auth/guards";
import { db } from "~/server/db";
import { generateSearchableText } from "~/server/search/index";
import type { Transcript } from "~/server/transcription/types";
import type { ExtractionData } from "~/server/extraction/types";
import { z } from "zod";
import { isAdvisorActor, meetingAllowsTranscriptEdit } from "~/lib/meeting-workflow";

export const runtime = "nodejs";

const segmentSchema = z.object({
  startTime: z.number(),
  endTime: z.number(),
  speaker: z.string(),
  text: z.string(),
});

const bodySchema = z.object({
  segments: z.array(segmentSchema).min(1),
  duration: z.number().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  try {
    const access = await requireAppAccess();
    if (!access.ok) {
      return Response.json({ success: false, error: access.error }, { status: access.status });
    }
    const { session, workspaceId } = access;

    if (!isAdvisorActor(session.user.role)) {
      return Response.json(
        { success: false, error: "Only advisor or workspace owner may edit the transcript" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const meeting = await db.meeting.findFirst({
      where: { id, workspaceId },
    });
    if (!meeting) {
      return Response.json({ success: false, error: "Meeting not found" }, { status: 404 });
    }

    if (!meetingAllowsTranscriptEdit(meeting.status)) {
      return Response.json(
        {
          success: false,
          error: "Transcript is locked after advisor certification or finalization",
        },
        { status: 400 }
      );
    }

    const json = await request.json();
    const { segments, duration } = bodySchema.parse(json);

    const transcriptJson = {
      segments,
      ...(duration !== undefined ? { duration } : {}),
    };

    const transcriptForSearch: Transcript = { segments };
    const extraction = meeting.extraction as ExtractionData | null;
    const searchableText = generateSearchableText(transcriptForSearch, extraction);

    const updated = await db.$transaction(async (tx) => {
      const m = await tx.meeting.update({
        where: { id },
        data: {
          transcript: transcriptJson as object,
          searchableText,
        },
      });

      const nextVersion = ((await tx.version.findFirst({
        where: { meetingId: meeting.id },
        orderBy: { version: "desc" },
      }))?.version ?? 0) + 1;

      await tx.version.create({
        data: {
          meetingId: meeting.id,
          version: nextVersion,
          editorId: session.user.id,
          whatChanged: "transcript: segment text updated",
          reason: "Transcript correction",
        },
      });

      await tx.auditEvent.create({
        data: {
          workspaceId,
          userId: session.user.id,
          action: "EDIT",
          resourceType: "meeting",
          resourceId: meeting.id,
          meetingId: meeting.id,
          metadata: {
            field: "transcript",
            segmentCount: segments.length,
          },
        },
      });

      return m;
    });

    return Response.json({
      success: true,
      data: {
        meetingId: updated.id,
        updatedAt: updated.updatedAt.toISOString(),
      },
    });
  } catch (e) {
    console.error("transcript patch:", e);
    if (e instanceof z.ZodError) {
      return Response.json({ success: false, error: "Invalid transcript payload", details: e.errors }, { status: 400 });
    }
    return Response.json(
      { success: false, error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}
