import type { TranscriptSegment } from "../transcription/types";
import { sortSegmentsByStart } from "./deterministic";

/**
 * CV-TR-07: the canonical transcript serialisation.
 *
 * This is the single authoritative byte form of a transcript. It is used for
 * BOTH `Meeting.transcriptSha256` AND the pack's 04_Transcript.txt entry, so
 * there is exactly one hash of a transcript and no ambiguity about which is
 * authoritative. Any change here changes pack bytes — the CV-TR-02a
 * determinism suite must be updated deliberately alongside it.
 */
export function canonicalTranscriptText(segments: TranscriptSegment[]): string {
  return generateTranscriptTXT(sortSegmentsByStart(segments));
}

/**
 * Generate Transcript Export (TXT)
 * Format: [HH:MM:SS] Speaker: text
 */
export function generateTranscriptTXT(segments: TranscriptSegment[]): string {
  const lines: string[] = [];

  segments.forEach((segment) => {
    const timestamp = formatTime(segment.startTime);
    const speaker = segment.speaker || "Unknown";
    const text = segment.text.trim();

    if (text) {
      lines.push(`[${timestamp}] ${speaker}: ${text}`);
    }
  });

  return lines.join("\n");
}

/**
 * Format time in HH:MM:SS format
 */
function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

