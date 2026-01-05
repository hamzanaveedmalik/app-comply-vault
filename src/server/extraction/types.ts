/**
 * Types for LLM-based field extraction from transcripts
 */

/**
 * Evidence item linking a claim to a transcript timestamp
 */
export interface EvidenceItem {
  startTime: number; // seconds
  endTime: number; // seconds
  snippet: string; // transcript text from that time range
}

/**
 * Extracted recommendation with evidence
 */
export interface ExtractedRecommendation {
  text: string;
  startTime: number;
  endTime: number;
  snippet: string;
  confidence?: number; // 0-1 scale, optional from LLM
}

/**
 * Extracted disclosure with evidence
 */
export interface ExtractedDisclosure {
  text: string;
  startTime: number;
  endTime: number;
  snippet: string;
  confidence?: number;
}

/**
 * Extracted decision with evidence
 */
export interface ExtractedDecision {
  text: string;
  startTime: number;
  endTime: number;
  snippet: string;
  confidence?: number;
}

/**
 * Extracted follow-up with evidence
 */
export interface ExtractedFollowUp {
  text: string;
  startTime: number;
  endTime: number;
  snippet: string;
  confidence?: number;
}

/**
 * Complete extraction result from LLM
 */
export interface ExtractionResult {
  topics: string[];
  recommendations: ExtractedRecommendation[];
  disclosures: ExtractedDisclosure[];
  decisions: ExtractedDecision[];
  followUps: ExtractedFollowUp[];
  provider: string; // "openai" | "anthropic"
  processingTime: number; // milliseconds
}

/**
 * Evidence map item for storage in database
 */
export interface EvidenceMapItem {
  field: "recommendation" | "disclosure" | "decision" | "followUp";
  claim: string; // The extracted text
  startTime: number;
  endTime: number;
  snippet: string;
  confidence: number; // 0-1 scale
  edited: boolean; // false initially, true if user edits
}

/**
 * Extraction data stored in Meeting.extraction JSON field
 */
export interface ExtractionData {
  topics: string[];
  recommendations: ExtractedRecommendation[];
  disclosures: ExtractedDisclosure[];
  decisions: ExtractedDecision[];
  followUps: ExtractedFollowUp[];
  evidenceMap: EvidenceMapItem[];
  extractedAt: string; // ISO timestamp
  provider: string;
  processingTime: number;
}

