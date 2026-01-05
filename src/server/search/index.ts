/**
 * Search Indexing Utilities
 * 
 * Creates searchable text from transcript and extraction data for fast keyword search.
 * This implements Story 7.4: Transcript and Field Indexing
 */

import type { Transcript } from "~/server/transcription/types";
import type { ExtractionData } from "~/server/extraction/types";

/**
 * Generates searchable text from transcript and extraction data
 * This text is stored in Meeting.searchableText for fast keyword search
 */
export function generateSearchableText(
  transcript: Transcript | null | undefined,
  extraction: ExtractionData | null | undefined
): string {
  const parts: string[] = [];

  // Add transcript text
  if (transcript?.segments) {
    const transcriptText = transcript.segments
      .map((seg) => seg.text)
      .join(" ")
      .toLowerCase();
    parts.push(transcriptText);
  }

  // Add extracted fields
  if (extraction) {
    // Topics
    if (extraction.topics && extraction.topics.length > 0) {
      parts.push(extraction.topics.join(" ").toLowerCase());
    }

    // Recommendations
    if (extraction.recommendations && extraction.recommendations.length > 0) {
      const recText = extraction.recommendations
        .map((r) => r.text)
        .join(" ")
        .toLowerCase();
      parts.push(recText);
    }

    // Disclosures
    if (extraction.disclosures && extraction.disclosures.length > 0) {
      const discText = extraction.disclosures
        .map((d) => d.text)
        .join(" ")
        .toLowerCase();
      parts.push(discText);
    }

    // Decisions
    if (extraction.decisions && extraction.decisions.length > 0) {
      const decText = extraction.decisions
        .map((d) => d.text)
        .join(" ")
        .toLowerCase();
      parts.push(decText);
    }

    // Follow-ups
    if (extraction.followUps && extraction.followUps.length > 0) {
      const followText = extraction.followUps
        .map((f) => f.text)
        .join(" ")
        .toLowerCase();
      parts.push(followText);
    }
  }

  // Join all parts and normalize whitespace
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

