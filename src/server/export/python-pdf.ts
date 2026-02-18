import { spawn } from "node:child_process";
import path from "node:path";
import type { Meeting, User, Version, Workspace } from "./types";
import type { ExtractionData } from "../extraction/types";
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
  topics: string[];
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
  const min = Math.floor(endSec / 60);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

/**
 * Build JSON payload for Python ReportLab PDF generator
 */
export function buildExportPayload(
  meeting: Meeting & { finalizedBy?: User | null },
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
  watermarked: boolean
): ExportPayload {
  const segments = transcript?.segments ?? [];
  const dateStr: string = meeting.meetingDate
    ? (new Date(meeting.meetingDate).toISOString().split("T")[0] ?? "")
    : "";

  const advisorName =
    meeting.finalizedBy?.name ??
    meeting.finalizedBy?.email ??
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

  const auditTrail: ExportPayload["audit_trail"] = [
    {
      timestamp: meeting.sourceUploadedAt
        ? new Date(meeting.sourceUploadedAt).toLocaleString()
        : new Date(meeting.createdAt).toLocaleString(),
      event: "Recording uploaded",
      user: "System",
      detail: "",
    },
    {
      timestamp: meeting.draftReadyAt
        ? new Date(meeting.draftReadyAt).toLocaleString()
        : new Date(meeting.updatedAt).toLocaleString(),
      event: "Transcription completed",
      user: "System",
      detail: `(${wordCount} words)`,
    },
    {
      timestamp: extraction.extractedAt
        ? new Date(extraction.extractedAt).toLocaleString()
        : new Date().toLocaleString(),
      event: "Compliance note generated",
      user: "System",
      detail: `(${extraction.topics?.length ?? 0} sections, ${evidenceLinks.length} evidence links)`,
    },
    {
      timestamp: new Date().toLocaleString(),
      event: "Compliance flags raised",
      user: "System",
      detail: `(${highCount} HIGH, ${medCount} MEDIUM, ${infoCount} INFO)`,
    },
    {
      timestamp: new Date().toLocaleString(),
      event: "Pack exported",
      user: "System",
      detail: "PDF + Evidence CSV + Version History + TXT",
    },
    {
      timestamp: meeting.finalizedAt
        ? new Date(meeting.finalizedAt).toLocaleString()
        : "",
      event: "Advisor sign-off",
      user: meeting.finalizedAt ? advisorName : "Pending",
      detail: meeting.finalizedAt ? "Completed" : "Pending",
    },
  ];

  return {
    client_name: meeting.clientName ?? "N/A",
    firm_name: workspace.name ?? "N/A",
    advisor_name: advisorName,
    date: dateStr,
    meeting_type: meeting.meetingType ?? "N/A",
    duration: formatDuration(segments),
    format: "Virtual / Zoom",
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
    topics: extraction.topics ?? [],
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

/**
 * Invoke Python script to generate branded PDF. Returns Buffer or throws.
 */
export async function runPythonPDFGenerator(
  payload: ExportPayload,
  logoPath: string
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(process.cwd(), "scripts", "generate-audit-pdf.py");
    const python =
      process.platform === "win32" ? "python" : "python3";
    const args = ["--logo-path", logoPath];

    const child = spawn(python, [scriptPath, ...args], {
      stdio: ["pipe", "pipe", "pipe"],
    });

    const chunks: Buffer[] = [];
    let stderr = "";

    child.stdout.on("data", (chunk: Buffer) => chunks.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    child.on("error", (err) => {
      reject(new Error(`Python spawn failed: ${err.message}`));
    });

    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`Python script failed (${code}): ${stderr || "Unknown error"}`));
        return;
      }
      resolve(Buffer.concat(chunks));
    });

    child.stdin.write(JSON.stringify(payload), "utf-8", (err) => {
      if (err) {
        reject(err);
        return;
      }
      child.stdin.end();
    });
  });
}
