/**
 * Search Indexing Utilities
 * 
 * Creates searchable text from transcript and extraction data for fast keyword search.
 * This implements Story 7.4: Transcript and Field Indexing
 */

import type { Transcript } from "~/server/transcription/types";
import type { ExtractionData } from "~/server/extraction/types";
import { topicToString } from "~/lib/topics";

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
      parts.push(extraction.topics.map(topicToString).join(" ").toLowerCase());
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
  const fullText = parts.join(" ").replace(/\s+/g, " ").trim();
  
  // Limit to 50KB to prevent database issues
  // PostgreSQL btree indexes have a limit of ~2700 bytes per index entry
  // We store this without a btree index and use PostgreSQL's native full-text search
  // 50KB is still plenty for search - most transcripts are much smaller
  const MAX_SEARCHABLE_TEXT_LENGTH = 50 * 1024; // 50KB
  
  if (fullText.length > MAX_SEARCHABLE_TEXT_LENGTH) {
    console.warn(`⚠️ searchableText exceeds ${MAX_SEARCHABLE_TEXT_LENGTH} bytes (${fullText.length}), truncating`);
    // Truncate but keep it searchable by taking from the beginning
    return fullText.substring(0, MAX_SEARCHABLE_TEXT_LENGTH);
  }
  
  return fullText;
}

