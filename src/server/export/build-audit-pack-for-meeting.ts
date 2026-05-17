/**
 * Build audit pack ZIP in server jobs (Export route uses the same via generateAuditPack)
 */

import { db } from "~/server/db";
import { generateAuditPack, generateExportFilename } from "~/server/export";
import type { ExtractionData } from "~/server/extraction/types";
import type { TranscriptSegment } from "~/server/transcription/types";
import type { Meeting, User } from "~/server/export/types";
import { getEntitlements, isTrialExpired } from "~/server/billing/entitlements";

export type BuildAuditPackResult =
  | { success: true; buffer: Buffer; filename: string }
  | { success: false; error: string };

/**
 * Produces the same audit pack ZIP as POST /api/meetings/:id/export (without audit log / HTTP).
 */
const EXPORTABLE_MEETING_STATUSES = new Set([
  "FINALIZED",
  "CCO_SIGNED_OFF",
  "CM_REVIEWED",
  "ADVISOR_CERTIFIED",
  "DRAFT_READY",
  "DRAFT",
]);

export async function buildAuditPackZipForMeeting(args: {
  meetingId: string;
  workspaceId: string;
  exportingUserName: string;
}): Promise<BuildAuditPackResult> {
  const { meetingId, workspaceId, exportingUserName } = args;

  const meeting = await db.meeting.findFirst({
    where: { id: meetingId, workspaceId },
  });

  if (!meeting) {
    return { success: false, error: "Meeting not found" };
  }

  if (!EXPORTABLE_MEETING_STATUSES.has(meeting.status)) {
    return { success: false, error: "Meeting must be in an exportable status" };
  }

  const extraction = meeting.extraction as ExtractionData | null;
  if (!extraction) {
    return { success: false, error: "Meeting does not have extraction data" };
  }

  if (!extraction.evidenceMap) extraction.evidenceMap = [];
  if (!extraction.topics) extraction.topics = [];
  if (!extraction.recommendations) extraction.recommendations = [];
  if (!extraction.disclosures) extraction.disclosures = [];
  if (!extraction.decisions) extraction.decisions = [];
  if (!extraction.followUps) extraction.followUps = [];

  const transcript = meeting.transcript as { segments: TranscriptSegment[] } | null | undefined;
  if (!transcript?.segments) {
    return { success: false, error: "Meeting does not have a transcript" };
  }

  const workspace = await db.workspace.findUnique({ where: { id: workspaceId } });
  if (!workspace) {
    return { success: false, error: "Workspace not found" };
  }

  const trialExpired = workspace.billingStatus === "TRIALING" && isTrialExpired(workspace.trialEndsAt);
  const entitlements = getEntitlements({
    billingStatus: workspace.billingStatus,
    planTier: workspace.planTier,
    trialEndsAt: workspace.trialEndsAt,
  });
  const watermarked = (entitlements?.exportsWatermarked ?? false) || trialExpired;

  let finalizedByUser = null;
  if (meeting.finalizedBy) {
    finalizedByUser = await db.user.findUnique({ where: { id: meeting.finalizedBy } });
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

  const flagsRaw = await db.flag.findMany({ where: { meetingId: meeting.id } });
  const flags = flagsRaw.map((f) => ({
    type: f.type,
    severity: f.severity,
    status: f.status,
    evidence: f.evidence,
  }));

  const versionsRaw = await db.version.findMany({
    where: { meetingId: meeting.id },
    orderBy: { timestamp: "asc" },
  });
  const versions = versionsRaw.map((v) => ({
    id: v.id,
    meetingId: v.meetingId,
    version: v.version,
    editorId: v.editorId,
    whatChanged: v.whatChanged,
    reason: v.reason,
    timestamp: v.timestamp,
  }));

  const { finalizedBy: _fb, ...meetingRest } = meeting;
  const meetingForExport = {
    ...meetingRest,
    finalizedBy: finalizedByUser,
    advisorCertifiedByUser: advisorCertifiedByUser ?? undefined,
    cmReviewedByUser: cmReviewedByUser ?? undefined,
    ccoSignedOffByUser: ccoSignedOffByUser ?? undefined,
  } as Meeting & { finalizedBy?: User | null };

  const buffer = await generateAuditPack({
    meeting: meetingForExport,
    extraction,
    transcript,
    versions,
    workspace,
    flags,
    watermarked,
    exportingUserName,
  });

  const filename = generateExportFilename(workspace.name, meeting.clientName, { watermarked });
  return { success: true, buffer, filename };
}
