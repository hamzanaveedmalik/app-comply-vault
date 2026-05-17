/**
 * Build export payload for PDF generation.
 * Used by PDFKit implementation.
 */

import type { Meeting, User, Version, Workspace } from "./types";
import type { ExtractionData } from "../extraction/types";
import { normalizeTopic } from "~/lib/topics";
import type { TranscriptSegment } from "../transcription/types";

export interface ExportPayload {
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
  _transcript_segments?: TranscriptSegment[];
}

function getSpeakerAtTime(
  segments: TranscriptSegment[],
  startTime: number
): string {
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
  options?: { exportingUserName?: string }
): ExportPayload {
  const segments = transcript?.segments ?? [];
  const dateStr: string = meeting.meetingDate
    ? (new Date(meeting.meetingDate).toISOString().split("T")[0] ?? "")
    : "";

  const advisorName =
    meeting.finalizedBy?.name ??
    meeting.finalizedBy?.email ??
    (extraction as { advisorName?: string }).advisorName ??
    options?.exportingUserName ??
    "Advisor";

  const evidenceLinks = (extraction.evidenceMap ?? []).map((ev, i) => ({
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
    segments.reduce((acc, s) => acc + (s.text?.split(/\s+/).length ?? 0), 0) ||
    0;

  const highCount = flags.filter((f) => f.severity === "CRITICAL").length;
  const medCount = flags.filter((f) => f.severity === "WARN").length;
  const infoCount = flags.filter((f) => f.severity === "INFO").length;

  // Transcript upload (no recording file) vs Virtual/Zoom vs Teams
  const format =
    !meeting.fileUrl && meeting.sourceFileMime === "text/plain"
      ? "Transcript Upload"
      : meeting.sourceFileMime === "text/vtt"
        ? "Teams"
        : "Virtual / Zoom";
  const duration = formatDuration(segments);
  const exportingUser = options?.exportingUserName ?? "System";

  const auditTrail: ExportPayload["audit_trail"] = [
    {
      timestamp: meeting.sourceUploadedAt
        ? new Date(meeting.sourceUploadedAt).toLocaleString()
        : new Date(meeting.createdAt).toLocaleString(),
      event: "Meeting recording uploaded",
      user: "System",
      detail: `${format} — ${duration}`,
    },
    {
      timestamp: meeting.draftReadyAt
        ? new Date(meeting.draftReadyAt).toLocaleString()
        : new Date(meeting.updatedAt).toLocaleString(),
      event: "Transcription completed",
      user: "System",
      detail: `Speaker-labeled transcript — ${wordCount} words`,
    },
    {
      timestamp: extraction.extractedAt
        ? new Date(extraction.extractedAt).toLocaleString()
        : new Date().toLocaleString(),
      event: "Compliance note generated",
      user: "System (AI)",
      detail: `Initial draft — ${extraction.topics?.length ?? 0} sections, ${evidenceLinks.length} evidence links`,
    },
    {
      timestamp: new Date().toLocaleString(),
      event: "Compliance flags raised",
      user: "System (AI)",
      detail: `${flags.length} flags: ${highCount} HIGH, ${medCount} MEDIUM, ${infoCount} INFO`,
    },
    ...(meeting.advisorCertifiedAt
      ? [
          {
            timestamp: new Date(meeting.advisorCertifiedAt).toLocaleString(),
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
            timestamp: new Date(meeting.cmReviewedAt).toLocaleString(),
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
            timestamp: new Date(meeting.ccoSignedOffAt).toLocaleString(),
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
      timestamp: new Date().toLocaleString(),
      event: "Pack exported",
      user: exportingUser,
      detail: "PDF + Evidence CSV + Version History + Transcript TXT",
    },
    {
      timestamp: meeting.finalizedAt
        ? new Date(meeting.finalizedAt).toLocaleString()
        : "Pending",
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
    duration: formatDuration(segments),
    format:
      !meeting.fileUrl && meeting.sourceFileMime === "text/plain"
        ? "Transcript Upload"
        : meeting.sourceFileMime === "text/vtt"
          ? "Teams"
          : "Virtual / Zoom",
    generated_at: (extraction.extractedAt as string | undefined) ?? new Date().toISOString(),
    review_status: meeting.status ?? "N/A",
    pack_version: versions.length || 1,
    flags: flags.map((f) => ({
      type: f.type,
      severity: f.severity,
      status: f.status,
      evidence: f.evidence,
    })),
    action_items: actionItems,
    topics: (extraction.topics ?? []).map((t) => normalizeTopic(t)),
    recommendations: (extraction.recommendations ?? []).map((r) => ({
      text: typeof r === "string" ? r : r.text ?? "",
    })),
    disclosures: (extraction.disclosures ?? []).map((d) => ({
      text: typeof d === "string" ? d : d.text ?? "",
    })),
    evidence_links: evidenceLinks,
    audit_trail: auditTrail,
    finalized_at: meeting.finalizedAt
      ? new Date(meeting.finalizedAt).toISOString()
      : undefined,
    date_reviewed: meeting.finalizedAt
      ? new Date(meeting.finalizedAt).toISOString().slice(0, 10)
      : undefined,
    date_signed: meeting.finalizedAt
      ? new Date(meeting.finalizedAt).toISOString().slice(0, 10)
      : undefined,
    watermarked,
    _transcript_segments: segments,
  };
}
