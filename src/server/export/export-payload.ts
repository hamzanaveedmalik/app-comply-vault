/**
 * Build export payload for PDF generation.
 * Used by PDFKit implementation.
 *
 * CV-TR-02a: no wall-clock timestamps; all dates from stored fields / packTimestamp.
 */

import type { Meeting, User, Version, Workspace } from "./types";
import type { ExtractionData } from "../extraction/types";
import { normalizeTopic } from "~/lib/topics";
import type { TranscriptSegment } from "../transcription/types";
import type { FirmProfileExportSectionDto } from "~/lib/firm-profile-types";
import {
  formatUtcDate,
  formatUtcIso,
  resolvePackTimestamp,
  sortByStartTimeThenClaim,
  sortFlags,
  sortSegmentsByStart,
  sortVersions,
} from "./deterministic";
import {
  SEAL_COVER_COPY,
  type PackSealMetadata,
} from "./seal-metadata";

export type ExportPayload = {
  client_name: string;
  firm_name: string;
  advisor_name: string;
  date: string;
  meeting_type: string;
  duration: string;
  format: string;
  generated_at: string;
  review_status: string;
  pack_version: number;
  flags: Array<{ type: string; severity: string; status: string; evidence?: unknown }>;
  action_items: Array<{ action: string; owner: string; due: string; priority: string }>;
  topics: Array<{ title: string; description: string }>;
  recommendations: Array<{ text: string }>;
  disclosures: Array<{ text: string }>;
  evidence_links: Array<{
    id: string;
    claim: string;
    startTime: number;
    speaker: string;
    snippet: string;
    confidence?: number;
  }>;
  audit_trail: Array<{ timestamp: string; event: string; user: string; detail: string }>;
  finalized_at?: string;
  date_reviewed?: string;
  date_signed?: string;
  watermarked?: boolean;
  /** Instant used for PDF CreationDate / ModDate (deterministic file ID). */
  pack_timestamp: string;
  _transcript_segments?: TranscriptSegment[];
  firm_disclosure_profile?: FirmProfileExportSectionDto;
  /** CV-TR-02 — present only on sealed / deposit packs. */
  seal?: {
    sealId: string;
    sealedAt: string;
    packHash: string;
    coverCopy: string;
    custodyFooter?: string;
  };
};

function getSpeakerAtTime(segments: TranscriptSegment[], startTime: number): string {
  for (const s of segments) {
    const start = s.startTime ?? 0;
    const end = s.endTime ?? start + 60;
    if (start <= startTime && startTime <= end) {
      return s.speaker ?? "Unknown";
    }
  }
  return "Unknown";
}

function formatDuration(segments: TranscriptSegment[]): string {
  if (!segments?.length) return "N/A";
  const last = segments[segments.length - 1];
  const endSec = last?.endTime ?? 0;
  const totalMinutes = Math.floor(endSec / 60);
  if (totalMinutes < 60) return `${totalMinutes} minutes`;
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function resolveMeetingFormat(meeting: Meeting): string {
  if (!meeting.fileUrl && meeting.sourceFileMime === "text/plain") {
    return "Transcript Upload";
  }
  if (meeting.sourceFileMime === "text/vtt") {
    return "Teams";
  }
  return "Virtual / Zoom";
}

/**
 * Build export payload for PDF generation
 */
export function buildExportPayload(
  meeting: Meeting & {
    finalizedBy?: User | null;
    advisorCertifiedByUser?: User | null;
    cmReviewedByUser?: User | null;
    ccoSignedOffByUser?: User | null;
  },
  extraction: ExtractionData,
  transcript: { segments: TranscriptSegment[] } | null,
  versions: Version[],
  workspace: Workspace,
  flags: Array<{
    type: string;
    severity: string;
    status: string;
    evidence?: unknown;
  }>,
  watermarked: boolean,
  options?: {
    exportingUserName?: string;
    firmDisclosureProfile?: FirmProfileExportSectionDto;
    /** Captured once at seal protocol start (or equivalent). Never wall-clock now. */
    packTimestamp?: Date;
    /** CV-TR-02 / CV-TR-18 — omit for draft exports. */
    seal?: PackSealMetadata;
  },
): ExportPayload {
  const packAt = resolvePackTimestamp({
    packTimestamp: options?.packTimestamp,
    finalizedAt: meeting.finalizedAt,
    ccoSignedOffAt: meeting.ccoSignedOffAt,
    cmReviewedAt: meeting.cmReviewedAt,
    advisorCertifiedAt: meeting.advisorCertifiedAt,
    draftReadyAt: meeting.draftReadyAt,
    updatedAt: meeting.updatedAt,
    createdAt: meeting.createdAt,
  });
  const packIso = formatUtcIso(packAt);

  const segments = sortSegmentsByStart(transcript?.segments ?? []);
  const dateStr: string = meeting.meetingDate ? formatUtcDate(meeting.meetingDate) : "";

  const advisorName =
    meeting.finalizedBy?.name ??
    meeting.finalizedBy?.email ??
    (extraction as { advisorName?: string }).advisorName ??
    options?.exportingUserName ??
    "Advisor";

  const sortedEvidence = sortByStartTimeThenClaim(extraction.evidenceMap ?? []);
  const evidenceLinks = sortedEvidence.map((ev, i) => ({
    id: `E${i + 1}`,
    claim: ev.claim ?? "",
    startTime: ev.startTime ?? 0,
    speaker: getSpeakerAtTime(segments, ev.startTime ?? 0),
    snippet: ev.snippet ?? "",
    confidence: ev.confidence,
  }));

  const actionItems = (extraction.followUps ?? []).map((fu) => ({
    action: fu.text ?? "",
    owner: "Advisor",
    due: "TBD",
    priority: "LOW",
  }));

  const wordCount =
    segments.reduce((acc, s) => acc + (s.text?.split(/\s+/).length ?? 0), 0) || 0;

  const sortedFlags = sortFlags(flags);
  const highCount = sortedFlags.filter((f) => f.severity === "CRITICAL").length;
  const medCount = sortedFlags.filter((f) => f.severity === "WARN").length;
  const infoCount = sortedFlags.filter((f) => f.severity === "INFO").length;

  const format = resolveMeetingFormat(meeting);
  const duration = formatDuration(segments);
  const exportingUser = options?.exportingUserName ?? "System";
  const sortedVersions = sortVersions(versions);

  const extractionGeneratedAt = extraction.extractedAt
    ? formatUtcIso(extraction.extractedAt)
    : packIso;

  const auditTrail: ExportPayload["audit_trail"] = [
    {
      timestamp: meeting.sourceUploadedAt
        ? formatUtcIso(meeting.sourceUploadedAt)
        : formatUtcIso(meeting.createdAt),
      event: "Meeting recording uploaded",
      user: "System",
      detail: `${format} — ${duration}`,
    },
    {
      timestamp: meeting.draftReadyAt
        ? formatUtcIso(meeting.draftReadyAt)
        : formatUtcIso(meeting.updatedAt),
      event: "Transcription completed",
      user: "System",
      detail: `Speaker-labeled transcript — ${wordCount} words`,
    },
    {
      timestamp: extractionGeneratedAt,
      event: "Compliance note generated",
      user: "System (AI)",
      detail: `Initial draft — ${extraction.topics?.length ?? 0} sections, ${evidenceLinks.length} evidence links`,
    },
    {
      timestamp: extractionGeneratedAt,
      event: "Compliance flags raised",
      user: "System (AI)",
      detail: `${sortedFlags.length} flags: ${highCount} HIGH, ${medCount} MEDIUM, ${infoCount} INFO`,
    },
    ...(meeting.advisorCertifiedAt
      ? [
          {
            timestamp: formatUtcIso(meeting.advisorCertifiedAt),
            event: "Advisor certified transcript",
            user:
              meeting.advisorCertifiedByUser?.name ??
              meeting.advisorCertifiedByUser?.email ??
              "Advisor",
            detail: "Meeting record accuracy attestation",
          },
        ]
      : []),
    ...(meeting.cmReviewedAt
      ? [
          {
            timestamp: formatUtcIso(meeting.cmReviewedAt),
            event: "CM review completed",
            user:
              meeting.cmReviewedByUser?.name ??
              meeting.cmReviewedByUser?.email ??
              "Compliance Manager",
            detail: "All flags triaged",
          },
        ]
      : []),
    ...(meeting.ccoSignedOffAt
      ? [
          {
            timestamp: formatUtcIso(meeting.ccoSignedOffAt),
            event: "CCO compliance sign-off",
            user:
              meeting.ccoSignedOffByUser?.name ??
              meeting.ccoSignedOffByUser?.email ??
              "CCO",
            detail: "Regulatory review complete (separate from advisor attestation)",
          },
        ]
      : []),
    {
      timestamp: packIso,
      event: "Pack exported",
      user: exportingUser,
      detail: "PDF + Evidence CSV + Version History + Transcript TXT",
    },
    {
      timestamp: meeting.finalizedAt ? formatUtcIso(meeting.finalizedAt) : "Pending",
      event: "Advisor sign-off",
      user: meeting.finalizedAt ? advisorName : exportingUser,
      detail: meeting.finalizedAt ? "Completed" : "Awaiting review and digital signature",
    },
  ];

  return {
    client_name: meeting.clientName ?? "N/A",
    firm_name: workspace.name ?? "N/A",
    advisor_name: advisorName,
    date: dateStr,
    meeting_type: meeting.meetingType ?? "N/A",
    duration,
    format,
    generated_at: extractionGeneratedAt,
    review_status: meeting.status ?? "N/A",
    pack_version: sortedVersions.length || 1,
    flags: sortedFlags.map((f) => ({
      type: f.type,
      severity: f.severity,
      status: f.status,
      evidence: f.evidence,
    })),
    action_items: actionItems,
    topics: (extraction.topics ?? []).map((t) => normalizeTopic(t)),
    recommendations: (extraction.recommendations ?? []).map((r) => ({
      text: typeof r === "string" ? r : (r.text ?? ""),
    })),
    disclosures: (extraction.disclosures ?? []).map((d) => ({
      text: typeof d === "string" ? d : (d.text ?? ""),
    })),
    evidence_links: evidenceLinks,
    audit_trail: auditTrail,
    finalized_at: meeting.finalizedAt ? formatUtcIso(meeting.finalizedAt) : undefined,
    date_reviewed: meeting.finalizedAt ? formatUtcDate(meeting.finalizedAt) : undefined,
    date_signed: meeting.finalizedAt ? formatUtcDate(meeting.finalizedAt) : undefined,
    watermarked,
    pack_timestamp: packIso,
    _transcript_segments: segments,
    firm_disclosure_profile: options?.firmDisclosureProfile,
    seal: options?.seal
      ? {
          sealId: options.seal.sealId,
          sealedAt: formatUtcIso(options.seal.sealedAt),
          packHash: options.seal.packHash,
          coverCopy: SEAL_COVER_COPY,
          custodyFooter: options.seal.custodyFooter,
        }
      : undefined,
  };
}
