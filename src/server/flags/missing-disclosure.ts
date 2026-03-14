import type { ExtractionData, ExtractedRecommendation, ExtractedDisclosure } from "~/server/extraction/types";

const DISCLOSURE_PATTERNS: RegExp[] = [
  /risk/i,
  /no guarantee/i,
  /may lose/i,
  /past performance/i,
  /conflict/i,
  /fees?/i,
  /compensation/i,
  /fiduciary/i,
  /suitability/i,
  /not tax advice/i,
  /not legal advice/i,
];

const DEFAULT_TIME_WINDOW_SECONDS = 180;

export interface MissingDisclosureFlagEvidence {
  recommendation: {
    text: string;
    startTime: number;
    endTime: number;
    snippet: string;
    confidence: number | undefined;
  };
  matchedDisclosure?: {
    text: string;
    startTime: number;
    endTime: number;
    snippet: string;
  };
  rule: {
    timeWindowSeconds: number;
    disclosurePatterns: string[];
  };
}

export interface MissingDisclosureFlag {
  type: "MISSING_DISCLOSURE";
  severity: "CRITICAL";
  evidence: MissingDisclosureFlagEvidence;
}

function matchesDisclosurePatterns(disclosure: ExtractedDisclosure): boolean {
  const text = `${disclosure.text ?? ""} ${disclosure.snippet ?? ""}`.trim();
  if (!text) {
    return false;
  }
  return DISCLOSURE_PATTERNS.some((pattern) => pattern.test(text));
}

function findRelevantDisclosure(
  recommendation: ExtractedRecommendation,
  disclosures: ExtractedDisclosure[],
  timeWindowSeconds: number
): ExtractedDisclosure | null {
  if (!disclosures.length) {
    return null;
  }

  const windowStart = Math.max(0, (recommendation.startTime ?? 0) - timeWindowSeconds);
  const windowEnd = (recommendation.endTime ?? 0) + timeWindowSeconds;

  const candidates = disclosures.filter((disclosure) => {
    const start = disclosure.startTime ?? 0;
    const end = disclosure.endTime ?? 0;
    return start <= windowEnd && end >= windowStart;
  });

  if (candidates.length === 0) {
    return null;
  }

  return candidates.find(matchesDisclosurePatterns) ?? candidates[0] ?? null;
}

export function detectMissingDisclosureFlags(
  extraction: ExtractionData,
  options?: {
    timeWindowSeconds?: number;
  }
): MissingDisclosureFlag[] {
  const recommendations = extraction.recommendations ?? [];
  const disclosures = extraction.disclosures ?? [];
  const timeWindowSeconds = options?.timeWindowSeconds ?? DEFAULT_TIME_WINDOW_SECONDS;

  if (recommendations.length === 0) {
    return [];
  }

  const flags: MissingDisclosureFlag[] = [];
  for (const rec of recommendations) {
    if (!rec.text || typeof rec.startTime !== "number" || typeof rec.endTime !== "number") continue;
    const matchedDisclosure = findRelevantDisclosure(rec, disclosures, timeWindowSeconds);
    const disclosureIsValid = matchedDisclosure ? matchesDisclosurePatterns(matchedDisclosure) : false;

    if (matchedDisclosure && disclosureIsValid) continue;

    flags.push({
      type: "MISSING_DISCLOSURE",
      severity: "CRITICAL",
      evidence: {
        recommendation: {
          text: rec.text,
          startTime: rec.startTime,
          endTime: rec.endTime,
          snippet: rec.snippet ?? "",
          confidence: rec.confidence,
        },
        matchedDisclosure: matchedDisclosure
          ? {
              text: matchedDisclosure.text ?? "",
              startTime: matchedDisclosure.startTime ?? 0,
              endTime: matchedDisclosure.endTime ?? 0,
              snippet: matchedDisclosure.snippet ?? "",
            }
          : undefined,
        rule: {
          timeWindowSeconds,
          disclosurePatterns: DISCLOSURE_PATTERNS.map((pattern) => pattern.source),
        },
      },
    });
  }
  return flags;
}
