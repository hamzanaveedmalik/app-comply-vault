import type { ExtractionData } from "../extraction/types";
import type { TranscriptSegment } from "../transcription/types";
import { topicToString } from "~/lib/topics";
import type { Version } from "./types";
import {
  formatUtcDate,
  formatUtcIso,
  sortByStartTimeThenClaim,
  sortVersions,
} from "./deterministic";

function getSpeakerAtTime(segments: TranscriptSegment[], startTime: number): string {
  for (const s of segments) {
    const start = s.startTime ?? 0;
    const end = s.endTime ?? start + 60;
    if (start <= startTime && startTime <= end) return s.speaker ?? "Unknown";
  }
  return "Unknown";
}

/**
 * Generate Evidence Map CSV
 * Columns: Evidence ID, Compliance Claim, Section Reference, Timestamp, Speaker,
 * Transcript Snippet, Confidence Score, Flag Triggered, Notes
 */
export function generateEvidenceMapCSV(
  extraction: ExtractionData,
  segments?: TranscriptSegment[]
): string {
  const headers = [
    "Evidence ID",
    "Compliance Claim",
    "Section Reference",
    "Timestamp",
    "Speaker",
    "Transcript Snippet",
    "Confidence Score",
    "Flag Triggered",
    "Notes",
  ];
  const rows: string[][] = [headers];

  const escapeCSV = (value: string): string => {
    if (value.includes(",") || value.includes('"') || value.includes("\n")) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  };

  if (!extraction.evidenceMap || extraction.evidenceMap.length === 0) {
    return headers.join(",") + "\n";
  }

  const segs = segments ?? [];
  sortByStartTimeThenClaim(extraction.evidenceMap).forEach((item, i) => {
    const startTime = item.startTime ?? 0;
    const timestamp = formatTime(startTime);
    const speaker = getSpeakerAtTime(segs, startTime);
    const confidence =
      item.confidence !== undefined && item.confidence !== null
        ? (item.confidence * 100).toFixed(0) + "%"
        : "";
    rows.push([
      `E${i + 1}`,
      escapeCSV(item.claim ?? ""),
      item.field ?? "",
      timestamp,
      escapeCSV(speaker),
      escapeCSV(item.snippet ?? ""),
      confidence,
      "",
      item.edited ? "Edited" : "",
    ]);
  });

  return rows.map((row) => row.join(",")).join("\n");
}

/**
 * Generate Version History CSV
 * Columns: Version, Timestamp, User, Role, Action Type, Section Affected,
 * Field Changed, Previous Value, New Value, Reason/Notes
 */
export function generateVersionHistoryCSV(versions: Version[]): string {
  const headers = [
    "Version",
    "Timestamp",
    "User",
    "Role",
    "Action Type",
    "Section Affected",
    "Field Changed",
    "Previous Value",
    "New Value",
    "Reason/Notes",
  ];
  const rows: string[][] = [headers];

  const escapeCSV = (value: string): string => {
    if (value.includes(",") || value.includes('"') || value.includes("\n")) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  };

  const sorted = sortVersions(versions);
  sorted.forEach((version) => {
    const timestamp = formatUtcIso(version.timestamp);
    const whatChanged = version.whatChanged || "";
    const reason = version.reason || "";
    rows.push([
      version.version.toString(),
      timestamp,
      version.editorId || "Unknown",
      "",
      "Edit",
      "",
      "",
      "",
      escapeCSV(whatChanged),
      escapeCSV(reason),
    ]);
  });

  if (sorted.length === 0) {
    return headers.join(",") + "\n";
  }

  return rows.map((row) => row.join(",")).join("\n");
}

/**
 * Generate Interaction Log Entry CSV
 */
export function generateInteractionLogCSV(
  meeting: { clientName: string; meetingDate: Date; meetingType: string; status: string },
  extraction: ExtractionData
): string {
  const headers = ["Client", "Date", "Type", "Keywords", "Recommendations", "Finalized"];
  const rows: string[][] = [headers];

  // Extract keywords from topics (first 5 topics as keywords)
  const keywords = extraction.topics?.slice(0, 5).map(topicToString).join("; ") || "N/A";
  
  // Recommendations Y/N
  const hasRecommendations = extraction.recommendations && extraction.recommendations.length > 0 ? "Y" : "N";
  
  // Finalized Y/N
  const isFinalized = meeting.status === "FINALIZED" ? "Y" : "N";

  const date = formatUtcDate(meeting.meetingDate);

  // Escape CSV values
  const escapeCSV = (value: string): string => {
    if (value.includes(",") || value.includes('"') || value.includes("\n")) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  };

  rows.push([
    escapeCSV(meeting.clientName),
    date,
    escapeCSV(meeting.meetingType),
    escapeCSV(keywords),
    hasRecommendations,
    isFinalized,
  ]);

  return rows.map((row) => row.join(",")).join("\n");
}

/**
 * Format time in HH:MM:SS format
 */
function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hours > 0) {
    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

