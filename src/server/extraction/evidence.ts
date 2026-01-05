import type {
  ExtractionResult,
  EvidenceMapItem,
  ExtractedRecommendation,
  ExtractedDisclosure,
  ExtractedDecision,
  ExtractedFollowUp,
  ExtractionData,
} from "./types";
import type { Transcript } from "../transcription/types";

/**
 * Create evidence map from extraction result
 * Links each extracted claim to transcript timestamps and snippets
 */
export function createEvidenceMap(
  extraction: ExtractionResult,
  transcript: Transcript
): EvidenceMapItem[] {
  const evidenceMap: EvidenceMapItem[] = [];

  // Helper to get transcript snippet for a time range
  const getSnippet = (startTime: number, endTime: number): string => {
    const relevantSegments = transcript.segments.filter(
      (seg) => seg.startTime <= endTime && seg.endTime >= startTime
    );
    return relevantSegments.map((seg) => seg.text).join(" ");
  };

  // Process recommendations
  extraction.recommendations.forEach((rec) => {
    const snippet = rec.snippet || getSnippet(rec.startTime, rec.endTime);
    evidenceMap.push({
      field: "recommendation",
      claim: rec.text,
      startTime: rec.startTime,
      endTime: rec.endTime,
      snippet,
      confidence: rec.confidence ?? 0.8,
      edited: false,
    });
  });

  // Process disclosures
  extraction.disclosures.forEach((dis) => {
    const snippet = dis.snippet || getSnippet(dis.startTime, dis.endTime);
    evidenceMap.push({
      field: "disclosure",
      claim: dis.text,
      startTime: dis.startTime,
      endTime: dis.endTime,
      snippet,
      confidence: dis.confidence ?? 0.8,
      edited: false,
    });
  });

  // Process decisions
  extraction.decisions.forEach((dec) => {
    const snippet = dec.snippet || getSnippet(dec.startTime, dec.endTime);
    evidenceMap.push({
      field: "decision",
      claim: dec.text,
      startTime: dec.startTime,
      endTime: dec.endTime,
      snippet,
      confidence: dec.confidence ?? 0.8,
      edited: false,
    });
  });

  // Process follow-ups
  extraction.followUps.forEach((fu) => {
    const snippet = fu.snippet || getSnippet(fu.startTime, fu.endTime);
    evidenceMap.push({
      field: "followUp",
      claim: fu.text,
      startTime: fu.startTime,
      endTime: fu.endTime,
      snippet,
      confidence: fu.confidence ?? 0.8,
      edited: false,
    });
  });

  return evidenceMap;
}

/**
 * Validate evidence coverage
 * Returns true if ≥ 90% of key claims have valid timestamp evidence (FR31)
 */
export function validateEvidenceCoverage(evidenceMap: EvidenceMapItem[]): {
  valid: boolean;
  coverage: number;
  totalClaims: number;
  validClaims: number;
} {
  const totalClaims = evidenceMap.length;
  if (totalClaims === 0) {
    return { valid: true, coverage: 1.0, totalClaims: 0, validClaims: 0 };
  }

  const validClaims = evidenceMap.filter((item) => {
    // Valid if startTime and endTime are positive numbers and snippet is non-empty
    return (
      typeof item.startTime === "number" &&
      item.startTime >= 0 &&
      typeof item.endTime === "number" &&
      item.endTime > item.startTime &&
      typeof item.snippet === "string" &&
      item.snippet.trim().length > 0
    );
  }).length;

  const coverage = validClaims / totalClaims;
  const valid = coverage >= 0.9; // ≥ 90% coverage required (FR31)

  return {
    valid,
    coverage,
    totalClaims,
    validClaims,
  };
}

/**
 * Convert extraction result to ExtractionData format for database storage
 */
export function toExtractionData(
  extraction: ExtractionResult,
  transcript: Transcript
): ExtractionData {
  const evidenceMap = createEvidenceMap(extraction, transcript);

  return {
    topics: extraction.topics,
    recommendations: extraction.recommendations,
    disclosures: extraction.disclosures,
    decisions: extraction.decisions,
    followUps: extraction.followUps,
    evidenceMap,
    extractedAt: new Date().toISOString(),
    provider: extraction.provider,
    processingTime: extraction.processingTime,
  };
}

