/**
 * CV-TR-01 — Nightly reconciliation: FINALIZED ↔ RecordSeal invariant.
 * Never un-finalises. Advances stuck seals to FINALIZED. Alerts on violations.
 */

import { db } from "~/server/db";

export type SealReconcileReport = {
  checkedAt: string;
  finalizedWithoutSeal: Array<{ meetingId: string; workspaceId: string }>;
  sealWithoutFinalized: Array<{
    meetingId: string;
    workspaceId: string;
    sealId: string;
    advanced: boolean;
  }>;
  alerts: string[];
};

/**
 * Assert every FINALIZED meeting has a RecordSeal; advance seal-without-FINALIZED.
 */
export async function reconcileRecordSeals(
  now: Date = new Date(),
): Promise<SealReconcileReport> {
  const alerts: string[] = [];

  const finalizedMeetings = await db.meeting.findMany({
    where: { status: "FINALIZED" },
    select: { id: true, workspaceId: true },
  });

  const seals = await db.recordSeal.findMany({
    select: {
      id: true,
      meetingId: true,
      workspaceId: true,
      sealedAt: true,
      sealedByUserId: true,
    },
  });

  const sealByMeeting = new Map(seals.map((s) => [s.meetingId, s]));

  const finalizedWithoutSeal: SealReconcileReport["finalizedWithoutSeal"] = [];
  for (const m of finalizedMeetings) {
    if (!sealByMeeting.has(m.id)) {
      finalizedWithoutSeal.push({
        meetingId: m.id,
        workspaceId: m.workspaceId,
      });
      alerts.push(
        `FINALIZED meeting ${m.id} in workspace ${m.workspaceId} has no RecordSeal`,
      );
    }
  }

  const meetingIdsWithSeal = seals.map((s) => s.meetingId);
  const meetingsForSeals =
    meetingIdsWithSeal.length === 0
      ? []
      : await db.meeting.findMany({
          where: { id: { in: meetingIdsWithSeal } },
          select: {
            id: true,
            workspaceId: true,
            status: true,
            finalizedAt: true,
            finalizedBy: true,
          },
        });
  const meetingById = new Map(meetingsForSeals.map((m) => [m.id, m]));

  const sealWithoutFinalized: SealReconcileReport["sealWithoutFinalized"] = [];

  for (const seal of seals) {
    const meeting = meetingById.get(seal.meetingId);
    if (!meeting) {
      alerts.push(
        `RecordSeal ${seal.id} references missing meeting ${seal.meetingId}`,
      );
      continue;
    }
    if (meeting.status === "FINALIZED") {
      continue;
    }

    // Advance to FINALIZED — never reverse.
    await db.meeting.update({
      where: { id: meeting.id },
      data: {
        status: "FINALIZED",
        finalizedAt: meeting.finalizedAt ?? seal.sealedAt,
        finalizedBy: meeting.finalizedBy ?? seal.sealedByUserId,
      },
    });

    sealWithoutFinalized.push({
      meetingId: meeting.id,
      workspaceId: meeting.workspaceId,
      sealId: seal.id,
      advanced: true,
    });

    await db.auditEvent.create({
      data: {
        workspaceId: meeting.workspaceId,
        userId: seal.sealedByUserId,
        action: "FINALIZE",
        resourceType: "meeting",
        resourceId: meeting.id,
        meetingId: meeting.id,
        metadata: {
          source: "seal_reconciliation",
          sealId: seal.id,
          previousStatus: meeting.status,
          reconciledAt: now.toISOString(),
        },
      },
    });
  }

  if (alerts.length > 0) {
    console.error("Seal reconciliation alerts:", {
      count: alerts.length,
      // IDs only — no PII
      alerts,
    });
  }

  return {
    checkedAt: now.toISOString(),
    finalizedWithoutSeal,
    sealWithoutFinalized,
    alerts,
  };
}
