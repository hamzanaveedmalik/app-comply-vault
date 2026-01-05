import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { z } from "zod";
import type { ExtractionData } from "~/server/extraction/types";

// Force Node.js runtime for this route
export const runtime = "nodejs";

const editFieldSchema = z.object({
  fieldType: z.enum(["topics", "recommendations", "disclosures", "decisions", "followUps"]),
  action: z.enum(["update", "add", "remove"]),
  index: z.number().optional(), // For update/remove
  item: z.object({
    text: z.string(),
    startTime: z.number().optional(),
    endTime: z.number().optional(),
    snippet: z.string().optional(),
    confidence: z.number().optional(),
  }).optional(), // For update/add
  reason: z.string().optional(), // Optional edit reason
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.workspaceId || !session.user.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const validatedData = editFieldSchema.parse(body);

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

    // Check if meeting is finalized (read-only) - return 403 Forbidden
    if (meeting.status === "FINALIZED") {
      return Response.json(
        { error: "Meeting is finalized and cannot be edited" },
        { status: 403 }
      );
    }
      return Response.json(
        { error: "Cannot edit finalized meetings" },
        { status: 403 }
      );
    }

    // Parse current extraction data
    const extraction = (meeting.extraction as ExtractionData | null) || {
      topics: [],
      recommendations: [],
      disclosures: [],
      decisions: [],
      followUps: [],
      evidenceMap: [],
      extractedAt: new Date().toISOString(),
      provider: "unknown",
      processingTime: 0,
    };

    // Get current version number
    const currentVersion = await db.version.findFirst({
      where: { meetingId: meeting.id },
      orderBy: { version: "desc" },
    });
    const nextVersion = (currentVersion?.version ?? 0) + 1;

    // Store old value for version history
    let oldValue: string | undefined;
    let newValue: string | undefined;

    // Perform the edit operation
    const fieldType = validatedData.fieldType;
    const fieldArray = extraction[fieldType] as any[];

    if (validatedData.action === "update" && validatedData.index !== undefined) {
      if (validatedData.index < 0 || validatedData.index >= fieldArray.length) {
        return Response.json({ error: "Invalid index" }, { status: 400 });
      }
      oldValue = JSON.stringify(fieldArray[validatedData.index]);
      if (validatedData.item) {
        fieldArray[validatedData.index] = {
          ...fieldArray[validatedData.index],
          ...validatedData.item,
        };
        newValue = JSON.stringify(fieldArray[validatedData.index]);
      }
    } else if (validatedData.action === "add") {
      if (!validatedData.item) {
        return Response.json({ error: "Item required for add action" }, { status: 400 });
      }
      fieldArray.push(validatedData.item);
      newValue = JSON.stringify(validatedData.item);
    } else if (validatedData.action === "remove" && validatedData.index !== undefined) {
      if (validatedData.index < 0 || validatedData.index >= fieldArray.length) {
        return Response.json({ error: "Invalid index" }, { status: 400 });
      }
      oldValue = JSON.stringify(fieldArray[validatedData.index]);
      fieldArray.splice(validatedData.index, 1);
    } else {
      return Response.json({ error: "Invalid action or missing parameters" }, { status: 400 });
    }

    // Update extraction data
    const updatedExtraction: ExtractionData = {
      ...extraction,
      [fieldType]: fieldArray,
    };

    // Update evidence map if item was edited
    if (validatedData.action === "update" && validatedData.index !== undefined && validatedData.item) {
      // Find corresponding evidence map item and mark as edited
      const item = fieldArray[validatedData.index];
      if (item.startTime !== undefined) {
        const evidenceMap = updatedExtraction.evidenceMap || [];
        const evidenceIndex = evidenceMap.findIndex(
          (e) => e.field === fieldType && e.startTime === item.startTime
        );
        if (evidenceIndex >= 0) {
          evidenceMap[evidenceIndex] = {
            ...evidenceMap[evidenceIndex],
            edited: true,
            claim: item.text || evidenceMap[evidenceIndex].claim,
          };
          updatedExtraction.evidenceMap = evidenceMap;
        }
      }
    }

    // Update meeting status to DRAFT if it was DRAFT_READY
    const newStatus = meeting.status === "DRAFT_READY" ? "DRAFT" : meeting.status;

    // Update meeting in database
    await db.meeting.update({
      where: { id: meeting.id },
      data: {
        extraction: updatedExtraction as any,
        status: newStatus,
      },
    });

    // Create version history entry
    const whatChanged = `${fieldType}[${validatedData.index ?? "new"}] ${validatedData.action}`;
    await db.version.create({
      data: {
        meetingId: meeting.id,
        version: nextVersion,
        editorId: session.user.id,
        whatChanged,
        reason: validatedData.reason || null,
      },
    });

    // Log edit event in audit log
    await db.auditEvent.create({
      data: {
        workspaceId: session.user.workspaceId,
        userId: session.user.id,
        action: "EDIT",
        resourceType: "meeting",
        resourceId: meeting.id,
        meetingId: meeting.id,
        metadata: {
          fieldType,
          action: validatedData.action,
          index: validatedData.index,
          reason: validatedData.reason,
          version: nextVersion,
        },
      },
    });

    return Response.json({
      success: true,
      extraction: updatedExtraction,
      version: nextVersion,
    });
  } catch (error) {
    console.error("Error editing field:", error);
    if (error instanceof z.ZodError) {
      return Response.json(
        { error: "Invalid request data", details: error.errors },
        { status: 400 }
      );
    }
    return Response.json(
      { error: "Failed to edit field" },
      { status: 500 }
    );
  }
}

