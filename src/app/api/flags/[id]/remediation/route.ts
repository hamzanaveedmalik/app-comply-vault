import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { z } from "zod";

const evidenceSchema = z.object({
  type: z.enum([
    "TRANSCRIPT_SNIPPET",
    "DOCUMENT_LINK",
    "OUTREACH_PROOF",
    "ACKNOWLEDGEMENT",
    "NOTE",
  ]),
  label: z.string().optional(),
  url: z.string().url().optional(),
  metadata: z.record(z.any()).optional(),
});

const remediationSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("START_REMEDIATION"),
    resolutionType: z.enum(["ADD_CONTEXT", "DISCLOSED_ELSEWHERE", "FOLLOW_UP_REQUIRED"]),
    rationale: z.string().min(50, "Rationale must be at least 50 characters"),
    dueDate: z.string().datetime(),
    sourceType: z.string().optional(),
    disclosureDate: z.string().datetime().optional(),
    acknowledgementStatus: z.enum(["YES", "NO", "UNKNOWN"]).optional(),
    followUpMethod: z.string().optional(),
    planNote: z.string().optional(),
    requireAcknowledgement: z.boolean().optional(),
    evidence: z.array(evidenceSchema).optional(),
  }),
  z.object({
    action: z.literal("ADD_EVIDENCE"),
    evidence: evidenceSchema,
  }),
  z.object({
    action: z.literal("COMPLETE_TASK"),
    taskId: z.string().min(1),
    completionNote: z.string().optional(),
  }),
  z.object({
    action: z.literal("SUBMIT_FOR_VERIFICATION"),
  }),
  z.object({
    action: z.literal("APPROVE"),
    note: z.string().optional(),
  }),
  z.object({
    action: z.literal("REJECT"),
    note: z.string().min(10, "Rejection note must be at least 10 characters"),
  }),
  z.object({
    action: z.literal("OVERRIDE"),
    reason: z.string().min(20, "Override reason must be at least 20 characters"),
    category: z.string().min(2, "Override category is required"),
  }),
]);

type EvidenceInput = z.infer<typeof evidenceSchema>;

const buildEvidenceRequirementError = (message: string) =>
  Response.json({ error: message }, { status: 400 });

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
    const payload = remediationSchema.parse(body);

    const ipAddress =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      request.headers.get("x-real-ip");
    const userAgent = request.headers.get("user-agent");
    const requestMetadata = { ipAddress, userAgent };

    const flag = await db.flag.findFirst({
      where: {
        id,
        workspaceId: session.user.workspaceId,
      },
      include: {
        resolutionRecord: {
          include: {
            tasks: true,
            evidence: true,
            verifications: true,
          },
        },
      },
    });

    if (!flag) {
      return Response.json({ error: "Flag not found" }, { status: 404 });
    }

    if (payload.action === "START_REMEDIATION") {
      if (flag.status !== "OPEN") {
        return Response.json(
          { error: "Remediation can only be started for open flags" },
          { status: 400 }
        );
      }
      if (flag.resolutionRecord) {
        return Response.json(
          { error: "Remediation already started for this flag" },
          { status: 400 }
        );
      }

      const dueDate = new Date(payload.dueDate);
      if (Number.isNaN(dueDate.valueOf())) {
        return Response.json({ error: "Invalid due date" }, { status: 400 });
      }

      const evidence = payload.evidence ?? [];
      const metadata: Record<string, unknown> = {
        sourceType: payload.sourceType,
        disclosureDate: payload.disclosureDate,
        acknowledgementStatus: payload.acknowledgementStatus,
        followUpMethod: payload.followUpMethod,
        planNote: payload.planNote,
        requireAcknowledgement: payload.requireAcknowledgement ?? false,
      };

      if (payload.resolutionType === "ADD_CONTEXT") {
        const hasTranscriptEvidence = evidence.some(
          (item) =>
            item.type === "TRANSCRIPT_SNIPPET" &&
            typeof (item.metadata as { startTime?: number } | undefined)?.startTime === "number"
        );
        if (!hasTranscriptEvidence) {
          return buildEvidenceRequirementError("Transcript evidence is required for Add context.");
        }
      }

      if (payload.resolutionType === "DISCLOSED_ELSEWHERE") {
        if (!payload.sourceType || !payload.disclosureDate || !payload.acknowledgementStatus) {
          return Response.json(
            { error: "Source type, disclosure date, and acknowledgement status are required." },
            { status: 400 }
          );
        }
        const hasDocumentEvidence = evidence.some(
          (item) => item.type === "DOCUMENT_LINK" && typeof item.url === "string" && item.url.trim()
        );
        if (!hasDocumentEvidence) {
          return buildEvidenceRequirementError("Disclosure evidence link is required.");
        }
      }

      if (payload.resolutionType === "FOLLOW_UP_REQUIRED") {
        if (!payload.followUpMethod || !payload.planNote?.trim()) {
          return Response.json(
            { error: "Follow-up method and plan note are required." },
            { status: 400 }
          );
        }
        if (payload.planNote.trim().length < 50) {
          return Response.json(
            { error: "Plan note must be at least 50 characters." },
            { status: 400 }
          );
        }
      }

      const tasks: {
        title: string;
        ownerId: string;
        dueDate: Date;
        required: boolean;
      }[] = [];

      if (payload.resolutionType === "ADD_CONTEXT") {
        tasks.push({
          title: "Add compliance context + link transcript evidence",
          ownerId: session.user.id,
          dueDate,
          required: true,
        });
      }

      if (payload.resolutionType === "DISCLOSED_ELSEWHERE") {
        tasks.push({
          title: "Validate disclosure evidence",
          ownerId: session.user.id,
          dueDate,
          required: true,
        });
        if (payload.acknowledgementStatus !== "YES") {
          tasks.push({
            title: "Obtain client acknowledgement",
            ownerId: session.user.id,
            dueDate: new Date(dueDate.getTime() + 7 * 24 * 60 * 60 * 1000),
            required: true,
          });
        }
      }

      if (payload.resolutionType === "FOLLOW_UP_REQUIRED") {
        tasks.push({
          title: "Send disclosure follow-up",
          ownerId: session.user.id,
          dueDate,
          required: true,
        });
        const requireAck = payload.requireAcknowledgement ?? flag.severity === "CRITICAL";
        if (requireAck) {
          tasks.push({
            title: "Collect acknowledgement",
            ownerId: session.user.id,
            dueDate: new Date(dueDate.getTime() + 7 * 24 * 60 * 60 * 1000),
            required: true,
          });
        }
      }

      const created = await db.$transaction(async (tx) => {
        const resolutionRecord = await tx.resolutionRecord.create({
          data: {
            workspaceId: flag.workspaceId,
            meetingId: flag.meetingId,
            flagId: flag.id,
            resolutionType: payload.resolutionType,
            rationale: payload.rationale.trim(),
            metadata,
            createdByUserId: session.user.id,
            tasks: {
              create: tasks,
            },
            evidence: {
              create: evidence.map((item) => ({
                type: item.type,
                label: item.label?.trim() || null,
                url: item.url,
                metadata: item.metadata ?? null,
                createdByUserId: session.user.id,
              })),
            },
          },
        });

        const updatedFlag = await tx.flag.update({
          where: { id: flag.id },
          data: {
            status: "IN_REMEDIATION",
            resolutionType: payload.resolutionType,
            resolutionNote: payload.rationale.trim(),
          },
        });

        await tx.auditEvent.create({
          data: {
            workspaceId: flag.workspaceId,
            userId: session.user.id,
            action: "REMEDIATION_START",
            resourceType: "flag",
            resourceId: flag.id,
            meetingId: flag.meetingId,
            metadata: {
              resolutionType: payload.resolutionType,
              rationale: payload.rationale.trim(),
              taskCount: tasks.length,
              ...requestMetadata,
            },
          },
        });

        if (evidence.length > 0) {
          await tx.auditEvent.create({
            data: {
              workspaceId: flag.workspaceId,
              userId: session.user.id,
              action: "EVIDENCE_ADD",
              resourceType: "flag",
              resourceId: flag.id,
              meetingId: flag.meetingId,
              metadata: {
                count: evidence.length,
                types: evidence.map((item) => item.type),
                ...requestMetadata,
              },
            },
          });
        }

        return { resolutionRecord, updatedFlag };
      });

      return Response.json({ success: true, flag: created.updatedFlag });
    }

    if (payload.action === "ADD_EVIDENCE") {
      if (!flag.resolutionRecord) {
        return Response.json({ error: "Remediation has not started" }, { status: 400 });
      }

      const createdEvidence = await db.$transaction(async (tx) => {
        const evidenceRecord = await tx.evidenceLink.create({
          data: {
            resolutionId: flag.resolutionRecord.id,
            type: payload.evidence.type,
            label: payload.evidence.label?.trim() || null,
            url: payload.evidence.url,
            metadata: payload.evidence.metadata ?? null,
            createdByUserId: session.user.id,
          },
        });

        await tx.auditEvent.create({
          data: {
            workspaceId: flag.workspaceId,
            userId: session.user.id,
            action: "EVIDENCE_ADD",
            resourceType: "flag",
            resourceId: flag.id,
            meetingId: flag.meetingId,
            metadata: {
              evidenceId: evidenceRecord.id,
              type: evidenceRecord.type,
              ...requestMetadata,
            },
          },
        });

        return evidenceRecord;
      });

      return Response.json({ success: true, evidence: createdEvidence });
    }

    if (payload.action === "COMPLETE_TASK") {
      if (!flag.resolutionRecord) {
        return Response.json({ error: "Remediation has not started" }, { status: 400 });
      }

      const task = flag.resolutionRecord.tasks.find((item) => item.id === payload.taskId);
      if (!task) {
        return Response.json({ error: "Task not found" }, { status: 404 });
      }

      const updatedTask = await db.$transaction(async (tx) => {
        const updated = await tx.actionItem.update({
          where: { id: task.id },
          data: {
            status: "COMPLETED",
            completionNote: payload.completionNote?.trim() || null,
            completedAt: new Date(),
          },
        });

        await tx.auditEvent.create({
          data: {
            workspaceId: flag.workspaceId,
            userId: session.user.id,
            action: "TASK_UPDATE",
            resourceType: "flag",
            resourceId: flag.id,
            meetingId: flag.meetingId,
            metadata: {
              taskId: task.id,
              status: "COMPLETED",
              ...requestMetadata,
            },
          },
        });

        return updated;
      });

      return Response.json({ success: true, task: updatedTask });
    }

    if (payload.action === "SUBMIT_FOR_VERIFICATION") {
      if (!flag.resolutionRecord) {
        return Response.json({ error: "Remediation has not started" }, { status: 400 });
      }

      const requiredTasksIncomplete = flag.resolutionRecord.tasks.some(
        (task) => task.required && task.status !== "COMPLETED"
      );
      if (requiredTasksIncomplete) {
        return Response.json(
          { error: "All required tasks must be completed before submission." },
          { status: 400 }
        );
      }

      const evidence = flag.resolutionRecord.evidence;
      const hasTranscriptEvidence = evidence.some((item) => item.type === "TRANSCRIPT_SNIPPET");
      const hasDocumentEvidence = evidence.some((item) => item.type === "DOCUMENT_LINK");
      const hasOutreachEvidence = evidence.some((item) => item.type === "OUTREACH_PROOF");
      const hasAckEvidence = evidence.some((item) => item.type === "ACKNOWLEDGEMENT");

      if (flag.resolutionRecord.resolutionType === "ADD_CONTEXT" && !hasTranscriptEvidence) {
        return buildEvidenceRequirementError("Transcript evidence is required before submission.");
      }
      if (flag.resolutionRecord.resolutionType === "DISCLOSED_ELSEWHERE" && !hasDocumentEvidence) {
        return buildEvidenceRequirementError("Disclosure evidence is required before submission.");
      }
      if (flag.resolutionRecord.resolutionType === "FOLLOW_UP_REQUIRED" && !hasOutreachEvidence) {
        return buildEvidenceRequirementError("Outreach evidence is required before submission.");
      }

      const requireAck =
        (flag.resolutionRecord.metadata as Record<string, unknown> | null)?.requireAcknowledgement ??
        (flag.severity === "CRITICAL");
      if (requireAck && !hasAckEvidence) {
        return buildEvidenceRequirementError("Acknowledgement evidence is required before submission.");
      }

      const isCritical = flag.severity === "CRITICAL";

      const result = await db.$transaction(async (tx) => {
        const updatedRecord = await tx.resolutionRecord.update({
          where: { id: flag.resolutionRecord!.id },
          data: {
            submittedForVerificationAt: new Date(),
          },
        });

        let updatedFlag;
        if (isCritical) {
          updatedFlag = await tx.flag.update({
            where: { id: flag.id },
            data: {
              status: "PENDING_VERIFICATION",
            },
          });
        } else {
          updatedFlag = await tx.flag.update({
            where: { id: flag.id },
            data: {
              status: "CLOSED",
              resolvedAt: new Date(),
              resolvedByUserId: session.user.id,
            },
          });

          await tx.resolutionRecord.update({
            where: { id: updatedRecord.id },
            data: {
              closedAt: new Date(),
              closedByUserId: session.user.id,
            },
          });

          await tx.verification.create({
            data: {
              resolutionId: updatedRecord.id,
              reviewerId: session.user.id,
              decision: "APPROVED",
              note: payload.action === "SUBMIT_FOR_VERIFICATION" ? "Auto-approved (non-critical)" : null,
            },
          });
        }

        await tx.auditEvent.create({
          data: {
            workspaceId: flag.workspaceId,
            userId: session.user.id,
            action: "REMEDIATION_UPDATE",
            resourceType: "flag",
            resourceId: flag.id,
            meetingId: flag.meetingId,
            metadata: {
              status: isCritical ? "PENDING_VERIFICATION" : "CLOSED",
              ...requestMetadata,
            },
          },
        });

        return updatedFlag;
      });

      return Response.json({ success: true, flag: result });
    }

    if (payload.action === "APPROVE") {
      if (session.user.role !== "OWNER_CCO") {
        return Response.json({ error: "Only CCO can approve remediation" }, { status: 403 });
      }
      if (!flag.resolutionRecord || flag.status !== "PENDING_VERIFICATION") {
        return Response.json({ error: "Flag is not pending verification" }, { status: 400 });
      }

      const updatedFlag = await db.$transaction(async (tx) => {
        await tx.verification.create({
          data: {
            resolutionId: flag.resolutionRecord!.id,
            reviewerId: session.user.id,
            decision: "APPROVED",
            note: payload.note?.trim() || null,
          },
        });

        await tx.resolutionRecord.update({
          where: { id: flag.resolutionRecord!.id },
          data: {
            closedAt: new Date(),
            closedByUserId: session.user.id,
          },
        });

        const updated = await tx.flag.update({
          where: { id: flag.id },
          data: {
            status: "CLOSED",
            resolvedAt: new Date(),
            resolvedByUserId: session.user.id,
          },
        });

        await tx.auditEvent.create({
          data: {
            workspaceId: flag.workspaceId,
            userId: session.user.id,
            action: "VERIFICATION",
            resourceType: "flag",
            resourceId: flag.id,
            meetingId: flag.meetingId,
            metadata: {
              decision: "APPROVED",
              ...requestMetadata,
            },
          },
        });

        return updated;
      });

      return Response.json({ success: true, flag: updatedFlag });
    }

    if (payload.action === "REJECT") {
      if (session.user.role !== "OWNER_CCO") {
        return Response.json({ error: "Only CCO can reject remediation" }, { status: 403 });
      }
      if (!flag.resolutionRecord || flag.status !== "PENDING_VERIFICATION") {
        return Response.json({ error: "Flag is not pending verification" }, { status: 400 });
      }

      const updatedFlag = await db.$transaction(async (tx) => {
        await tx.verification.create({
          data: {
            resolutionId: flag.resolutionRecord!.id,
            reviewerId: session.user.id,
            decision: "REJECTED",
            note: payload.note.trim(),
          },
        });

        const updated = await tx.flag.update({
          where: { id: flag.id },
          data: {
            status: "IN_REMEDIATION",
          },
        });

        await tx.auditEvent.create({
          data: {
            workspaceId: flag.workspaceId,
            userId: session.user.id,
            action: "VERIFICATION",
            resourceType: "flag",
            resourceId: flag.id,
            meetingId: flag.meetingId,
            metadata: {
              decision: "REJECTED",
              ...requestMetadata,
            },
          },
        });

        return updated;
      });

      return Response.json({ success: true, flag: updatedFlag });
    }

    if (payload.action === "OVERRIDE") {
      if (session.user.role !== "OWNER_CCO") {
        return Response.json({ error: "Only CCO can override flags" }, { status: 403 });
      }

      const updatedFlag = await db.$transaction(async (tx) => {
        let resolutionRecord = flag.resolutionRecord;
        if (!resolutionRecord) {
          resolutionRecord = await tx.resolutionRecord.create({
            data: {
              workspaceId: flag.workspaceId,
              meetingId: flag.meetingId,
              flagId: flag.id,
              resolutionType: "OVERRIDE_APPROVED",
              rationale: payload.reason.trim(),
              metadata: {
                overrideCategory: payload.category.trim(),
              },
              createdByUserId: session.user.id,
            },
          });
        } else {
          await tx.resolutionRecord.update({
            where: { id: resolutionRecord.id },
            data: {
              overrideReason: payload.reason.trim(),
              overrideCategory: payload.category.trim(),
            },
          });
        }

        await tx.verification.create({
          data: {
            resolutionId: resolutionRecord.id,
            reviewerId: session.user.id,
            decision: "APPROVED",
            note: `Accepted risk: ${payload.category.trim()}`,
          },
        });

        await tx.resolutionRecord.update({
          where: { id: resolutionRecord.id },
          data: {
            closedAt: new Date(),
            closedByUserId: session.user.id,
            overrideReason: payload.reason.trim(),
            overrideCategory: payload.category.trim(),
          },
        });

        const updated = await tx.flag.update({
          where: { id: flag.id },
          data: {
            status: "CLOSED_ACCEPTED_RISK",
            resolutionType: "OVERRIDE_APPROVED",
            resolutionNote: payload.reason.trim(),
            resolvedAt: new Date(),
            resolvedByUserId: session.user.id,
          },
        });

        await tx.auditEvent.create({
          data: {
            workspaceId: flag.workspaceId,
            userId: session.user.id,
            action: "OVERRIDE",
            resourceType: "flag",
            resourceId: flag.id,
            meetingId: flag.meetingId,
            metadata: {
              category: payload.category.trim(),
              ...requestMetadata,
            },
          },
        });

        return updated;
      });

      return Response.json({ success: true, flag: updatedFlag });
    }

    return Response.json({ error: "Unsupported action" }, { status: 400 });
  } catch (error) {
    console.error("Error in flag remediation:", error);
    if (error instanceof z.ZodError) {
      return Response.json(
        { error: "Invalid request body", details: error.errors },
        { status: 400 }
      );
    }
    return Response.json(
      { error: error instanceof Error ? error.message : "An unknown error occurred" },
      { status: 500 }
    );
  }
}
