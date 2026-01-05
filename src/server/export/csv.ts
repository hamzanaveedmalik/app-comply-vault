import type { ExtractionData, EvidenceMapItem } from "../extraction/types";
import type { Version } from "../../generated/prisma";

/**
 * Generate Evidence Map CSV
 */
export function generateEvidenceMapCSV(extraction: ExtractionData): string {
  const headers = ["Field", "Claim", "Start Time", "End Time", "Transcript Snippet", "Confidence", "Edited"];
  const rows: string[][] = [headers];

  extraction.evidenceMap.forEach((item) => {
    const startTime = formatTime(item.startTime);
    const endTime = formatTime(item.endTime);
    const confidence = item.confidence.toFixed(2);
    const edited = item.edited ? "Yes" : "No";
    
    // Escape CSV values (handle commas, quotes, newlines)
    const escapeCSV = (value: string): string => {
      if (value.includes(",") || value.includes('"') || value.includes("\n")) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    };

    rows.push([
      item.field,
      escapeCSV(item.claim),
      startTime,
      endTime,
      escapeCSV(item.snippet),
      confidence,
      edited,
    ]);
  });

  return rows.map((row) => row.join(",")).join("\n");
}

/**
 * Generate Version History CSV
 */
export function generateVersionHistoryCSV(versions: Version[]): string {
  const headers = ["Version", "Editor", "Timestamp", "What Changed", "Reason"];
  const rows: string[][] = [headers];

  versions.forEach((version) => {
    const timestamp = new Date(version.timestamp).toLocaleString();
    const whatChanged = version.whatChanged || "N/A";
    const reason = version.reason || "N/A";

    // Escape CSV values
    const escapeCSV = (value: string): string => {
      if (value.includes(",") || value.includes('"') || value.includes("\n")) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    };

    rows.push([
      version.version.toString(),
      version.editorId || "Unknown",
      timestamp,
      escapeCSV(whatChanged),
      escapeCSV(reason),
    ]);
  });

  // If no versions, return header only
  if (versions.length === 0) {
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
  const keywords = extraction.topics?.slice(0, 5).join("; ") || "N/A";
  
  // Recommendations Y/N
  const hasRecommendations = extraction.recommendations && extraction.recommendations.length > 0 ? "Y" : "N";
  
  // Finalized Y/N
  const isFinalized = meeting.status === "FINALIZED" ? "Y" : "N";

  const date = new Date(meeting.meetingDate).toLocaleDateString();

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

