/**
 * CV-TR-01 — Seal finalised packs to Object Lock (content-addressed dual-write).
 *
 * Protocol:
 * 1. Capture sealedAt once; allocate sealId.
 * 2. Generate canonical pack bytes (purpose: seal, unwatermarked).
 * 3. packHash = SHA-256(pack).
 * 4. PUT sealed bucket key = packHash, Object Lock until expiresAt.
 * 5. INSERT RecordSeal (unique on packHash / workspace+meeting).
 * 6. UPDATE meeting → FINALIZED.
 *
 * Failures before step 6 leave the meeting non-FINALIZED; retries are idempotent.
 * ⚠️ COMPLIANCE IMPACT: first Object Lock write path.
 */

import { Prisma } from "../../../generated/prisma";
import type { FinalizeReason } from "../../../generated/prisma";
import { db } from "~/server/db";
import { buildAuditPackZipForMeeting } from "~/server/export/build-audit-pack-for-meeting";
import { sha256FromBuffer } from "~/server/hash";
import { computeExpiresAt } from "~/server/retention/fiscal-year";
import { newRecordSealId } from "~/server/seal/seal-id";
import { putSealedObject } from "~/server/seal/sealed-storage";
import { resolveSealedObjectLockMode } from "~/server/seal/object-lock-mode";

export type SealMeetingInput = {
  meetingId: string;
  workspaceId: string;
  sealedByUserId: string;
  finalizeReason: FinalizeReason;
  finalizeNote?: string | null;
  timeToFinalize: number | null;
  /** Injected clock for tests. */
  now?: Date;
};

export type SealMeetingSuccess = {
  success: true;
  sealId: string;
  packHash: string;
  sealedAt: string;
  expiresAt: string;
  storageUri: string;
  retentionMode: "COMPLIANCE" | "GOVERNANCE";
  meeting: {
    id: string;
    status: string;
    finalizedAt: Date | null;
    finalizedBy: string | null;
    timeToFinalize: number | null;
    finalizeReason: string | null;
    finalizeNote: string | null;
  };
};

export type SealMeetingFailure = {
  success: false;
  error: string;
};

export type SealMeetingResult = SealMeetingSuccess | SealMeetingFailure;

/**
 * Run the seal + finalize protocol. Idempotent when RecordSeal already exists.
 */
export async function sealAndFinalizeMeeting(
  input: SealMeetingInput,
): Promise<SealMeetingResult> {
  const now = input.now ?? new Date();

  const meeting = await db.meeting.findFirst({
    where: { id: input.meetingId, workspaceId: input.workspaceId },
  });
  if (!meeting) {
    return { success: false, error: "Meeting not found" };
  }

  const existingSeal = await db.recordSeal.findUnique({
    where: {
      workspaceId_meetingId: {
        workspaceId: input.workspaceId,
        meetingId: input.meetingId,
      },
    },
  });

  // Idempotent retry: seal exists → ensure FINALIZED and return.
  if (existingSeal) {
    const finalized =
      meeting.status === "FINALIZED"
        ? meeting
        : await db.meeting.update({
            where: { id: meeting.id },
            data: {
              status: "FINALIZED",
              finalizedBy: meeting.finalizedBy ?? input.sealedByUserId,
              finalizedAt: meeting.finalizedAt ?? existingSeal.sealedAt,
              timeToFinalize: meeting.timeToFinalize ?? input.timeToFinalize,
              finalizeReason: meeting.finalizeReason ?? input.finalizeReason,
              finalizeNote:
                meeting.finalizeNote ??
                (input.finalizeNote?.trim() ? input.finalizeNote.trim() : null),
            },
          });

    return {
      success: true,
      sealId: existingSeal.id,
      packHash: existingSeal.packHash,
      sealedAt: existingSeal.sealedAt.toISOString(),
      expiresAt: existingSeal.expiresAt.toISOString(),
      storageUri: existingSeal.storageUri,
      retentionMode: resolveSealedObjectLockMode(),
      meeting: {
        id: finalized.id,
        status: finalized.status,
        finalizedAt: finalized.finalizedAt,
        finalizedBy: finalized.finalizedBy,
        timeToFinalize: finalized.timeToFinalize,
        finalizeReason: finalized.finalizeReason,
        finalizeNote: finalized.finalizeNote,
      },
    };
  }

  if (meeting.status === "FINALIZED") {
    return {
      success: false,
      error: "Meeting is FINALIZED without a RecordSeal — run reconciliation",
    };
  }

  if (meeting.status !== "CCO_SIGNED_OFF") {
    return {
      success: false,
      error: `Meeting must be CCO_SIGNED_OFF to seal. Current status: ${meeting.status}`,
    };
  }

  const workspace = await db.workspace.findUnique({
    where: { id: input.workspaceId },
  });
  if (!workspace) {
    return { success: false, error: "Workspace not found" };
  }

  const sealedAt = now;
  const sealId = newRecordSealId();
  const expiresAt = computeExpiresAt(sealedAt, {
    retentionYears: workspace.retentionYears,
    fiscalYearEndMonth: workspace.fiscalYearEndMonth,
    fiscalTimezone: workspace.fiscalTimezone,
  });

  // Two-pass cover hash (CV-TR-02):
  // Pass 1 builds sealed-layout bytes with a fixed 64-zero packHash placeholder.
  // Pass 2 embeds sha256(pass1) on the cover. Ledger + object key = sha256(pass2)
  // (complete sealed bytes). Cover shows the pass-1 digest so the field is stable
  // without solving a cryptographic fixed point; examiners confirm the complete-file
  // hash via the ledger / object key (Phase 1 copy).
  const placeholderHash = "0".repeat(64);

  const pass1 = await buildAuditPackZipForMeeting({
    meetingId: input.meetingId,
    workspaceId: input.workspaceId,
    exportingUserName: "ComplyVault",
    purpose: "seal",
    packTimestamp: sealedAt,
    seal: {
      sealId,
      sealedAt,
      expiresAt,
      packHash: placeholderHash,
    },
  });
  if (!pass1.success) {
    return { success: false, error: pass1.error };
  }

  const contentDigest = sha256FromBuffer(pass1.buffer);

  const pass2 = await buildAuditPackZipForMeeting({
    meetingId: input.meetingId,
    workspaceId: input.workspaceId,
    exportingUserName: "ComplyVault",
    purpose: "seal",
    packTimestamp: sealedAt,
    seal: {
      sealId,
      sealedAt,
      expiresAt,
      packHash: contentDigest,
    },
  });
  if (!pass2.success) {
    return { success: false, error: pass2.error };
  }

  const packHash = sha256FromBuffer(pass2.buffer);
  const retentionMode = resolveSealedObjectLockMode();

  let storageUri: string;
  try {
    const put = await putSealedObject({
      packHash,
      body: pass2.buffer,
      retainUntil: expiresAt,
      workspaceId: input.workspaceId,
      meetingId: input.meetingId,
      sealId,
    });
    storageUri = put.storageUri;
  } catch (err) {
    const message = err instanceof Error ? err.message : "sealed PUT failed";
    console.error("Seal PUT failed:", {
      meetingId: input.meetingId,
      workspaceId: input.workspaceId,
      message,
    });
    return { success: false, error: "Failed to write sealed object" };
  }

  try {
    const finalizedMeeting = await db.$transaction(async (tx) => {
      await tx.recordSeal.create({
        data: {
          id: sealId,
          workspaceId: input.workspaceId,
          meetingId: input.meetingId,
          packHash,
          sealedAt,
          sealedByUserId: input.sealedByUserId,
          storageUri,
          expiresAt,
        },
      });

      const updated = await tx.meeting.update({
        where: { id: meeting.id },
        data: {
          status: "FINALIZED",
          finalizedBy: input.sealedByUserId,
          finalizedAt: sealedAt,
          timeToFinalize: input.timeToFinalize,
          finalizeReason: input.finalizeReason,
          finalizeNote: input.finalizeNote?.trim() || null,
        },
      });

      await tx.auditEvent.create({
        data: {
          workspaceId: input.workspaceId,
          userId: input.sealedByUserId,
          action: "RECORD_SEALED",
          resourceType: "meeting",
          resourceId: meeting.id,
          meetingId: meeting.id,
          metadata: {
            sealId,
            packHash,
            sealedAt: sealedAt.toISOString(),
            expiresAt: expiresAt.toISOString(),
            storageUri,
            retentionMode,
            contentDigest,
          },
        },
      });

      await tx.auditEvent.create({
        data: {
          workspaceId: input.workspaceId,
          userId: input.sealedByUserId,
          action: "FINALIZE",
          resourceType: "meeting",
          resourceId: meeting.id,
          meetingId: meeting.id,
          metadata: {
            finalizedAt: sealedAt.toISOString(),
            previousStatus: meeting.status,
            timeToFinalize:
              input.timeToFinalize != null
                ? `${input.timeToFinalize}s`
                : undefined,
            finalizeReason: input.finalizeReason,
            finalizeNote: input.finalizeNote?.trim() ?? undefined,
            sealId,
            packHash,
          },
        },
      });

      return updated;
    });

    return {
      success: true,
      sealId,
      packHash,
      sealedAt: sealedAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
      storageUri,
      retentionMode,
      meeting: {
        id: finalizedMeeting.id,
        status: finalizedMeeting.status,
        finalizedAt: finalizedMeeting.finalizedAt,
        finalizedBy: finalizedMeeting.finalizedBy,
        timeToFinalize: finalizedMeeting.timeToFinalize,
        finalizeReason: finalizedMeeting.finalizeReason,
        finalizeNote: finalizedMeeting.finalizeNote,
      },
    };
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      // Concurrent insert — reload and advance to FINALIZED.
      const raced = await db.recordSeal.findUnique({
        where: {
          workspaceId_meetingId: {
            workspaceId: input.workspaceId,
            meetingId: input.meetingId,
          },
        },
      });
      if (raced) {
        const finalized = await db.meeting.update({
          where: { id: meeting.id },
          data: {
            status: "FINALIZED",
            finalizedBy: input.sealedByUserId,
            finalizedAt: raced.sealedAt,
            timeToFinalize: input.timeToFinalize,
            finalizeReason: input.finalizeReason,
            finalizeNote: input.finalizeNote?.trim() || null,
          },
        });
        return {
          success: true,
          sealId: raced.id,
          packHash: raced.packHash,
          sealedAt: raced.sealedAt.toISOString(),
          expiresAt: raced.expiresAt.toISOString(),
          storageUri: raced.storageUri,
          retentionMode,
          meeting: {
            id: finalized.id,
            status: finalized.status,
            finalizedAt: finalized.finalizedAt,
            finalizedBy: finalized.finalizedBy,
            timeToFinalize: finalized.timeToFinalize,
            finalizeReason: finalized.finalizeReason,
            finalizeNote: finalized.finalizeNote,
          },
        };
      }
    }
    console.error("RecordSeal INSERT / finalize transaction failed:", {
      meetingId: input.meetingId,
      workspaceId: input.workspaceId,
      message: err instanceof Error ? err.message : "transaction failed",
    });
    return {
      success: false,
      error: "Failed to write seal ledger entry",
    };
  }
}
