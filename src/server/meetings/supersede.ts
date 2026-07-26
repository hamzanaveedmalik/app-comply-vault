/**
 * CV-TR-16 — Supersede a sealed meeting with a new draft Meeting row.
 * ⚠️ COMPLIANCE IMPACT: original seal and flags are immutable; correction is additive.
 */

import { db } from "~/server/db";
import { assertMediaPostureSet } from "~/server/retention/media-posture";

export type SupersedeMeetingInput = {
  meetingId: string;
  workspaceId: string;
  actorUserId: string;
  reason: string;
};

export type SupersedeMeetingSuccess = {
  success: true;
  data: {
    originalMeetingId: string;
    replacementMeetingId: string;
    originalSealId: string;
    reason: string;
  };
};

export type SupersedeMeetingFailure = {
  success: false;
  error: string;
  status: number;
};

export type SupersedeMeetingResult =
  | SupersedeMeetingSuccess
  | SupersedeMeetingFailure;

const MIN_REASON_LENGTH = 10;

/**
 * Create a replacement Meeting that supersedes a sealed FINALIZED record.
 */
export async function supersedeMeeting(
  input: SupersedeMeetingInput,
): Promise<SupersedeMeetingResult> {
  const reason = input.reason.trim();
  if (reason.length < MIN_REASON_LENGTH) {
    return {
      success: false,
      status: 400,
      error: `A narrative supersession reason of at least ${MIN_REASON_LENGTH} characters is required`,
    };
  }

  const posture = await assertMediaPostureSet(input.workspaceId);
  if (!posture.ok) {
    return { success: false, status: posture.status, error: posture.error };
  }

  const original = await db.meeting.findFirst({
    where: { id: input.meetingId, workspaceId: input.workspaceId },
    include: {
      recordSeals: {
        orderBy: { sealedAt: "asc" },
        take: 1,
      },
    },
  });

  if (!original) {
    return { success: false, status: 404, error: "Meeting not found" };
  }

  if (original.status !== "FINALIZED") {
    return {
      success: false,
      status: 400,
      error: "Only sealed FINALIZED meetings can be superseded",
    };
  }

  if (original.supersededById) {
    return {
      success: false,
      status: 409,
      error: "Meeting has already been superseded",
    };
  }

  const seal = original.recordSeals[0];
  if (!seal) {
    return {
      success: false,
      status: 400,
      error: "Meeting has no RecordSeal; seal before superseding",
    };
  }

  if (!original.transcript) {
    return {
      success: false,
      status: 400,
      error: "Meeting has no transcript to carry forward",
    };
  }

  try {
    const result = await db.$transaction(async (tx) => {
      const replacement = await tx.meeting.create({
        data: {
          workspaceId: original.workspaceId,
          clientName: original.clientName,
          clientId: original.clientId,
          clientMatchConfidence: original.clientMatchConfidence,
          participantEmails: original.participantEmails,
          meetingType: original.meetingType,
          meetingDate: original.meetingDate,
          status: "DRAFT",
          // Source / transcript linkage — no extraction, flags, or finalisation.
          fileUrl: original.fileUrl,
          transcriptSha256: original.transcriptSha256,
          mediaDiscardedAt: original.mediaDiscardedAt,
          sourceFileSha256: original.sourceFileSha256,
          sourceFileName: original.sourceFileName,
          sourceFileSize: original.sourceFileSize,
          sourceFileMime: original.sourceFileMime,
          sourceUploadedAt: original.sourceUploadedAt,
          transcript: original.transcript ?? undefined,
          zohoCrmContactId: original.zohoCrmContactId,
          supersedesId: original.id,
          supersedeReason: reason,
        },
      });

      await tx.meeting.update({
        where: { id: original.id },
        data: {
          supersededById: replacement.id,
          supersedeReason: reason,
        },
      });

      await tx.auditEvent.create({
        data: {
          workspaceId: input.workspaceId,
          userId: input.actorUserId,
          action: "RECORD_SUPERSEDED",
          resourceType: "meeting",
          resourceId: original.id,
          meetingId: original.id,
          metadata: {
            originalMeetingId: original.id,
            replacementMeetingId: replacement.id,
            originalSealId: seal.id,
            originalPackHash: seal.packHash,
            reason,
          },
        },
      });

      return { replacementId: replacement.id, sealId: seal.id };
    });

    return {
      success: true,
      data: {
        originalMeetingId: original.id,
        replacementMeetingId: result.replacementId,
        originalSealId: result.sealId,
        reason,
      },
    };
  } catch (err) {
    console.error("supersedeMeeting failed:", {
      meetingId: input.meetingId,
      workspaceId: input.workspaceId,
      message: err instanceof Error ? err.message : "unknown",
    });
    return {
      success: false,
      status: 500,
      error: "Failed to supersede meeting",
    };
  }
}
