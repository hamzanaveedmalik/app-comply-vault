/**
 * CV-WEB-03 — Quantified marketing claims must carry a live methodology link
 * or be absent. Keep this list empty unless a methodology page exists.
 */

export type QuantifiedClaim = {
  id: string;
  text: string;
  /** Path to a live methodology note (required). */
  methodologyPath: string;
};

/**
 * No unsupported ROI / time-saved claims currently ship.
 * Add entries only with a real `/methodology/...` page.
 */
export const QUANTIFIED_MARKETING_CLAIMS: readonly QuantifiedClaim[] = [];

/** Phrases that must not appear in marketing page source without methodology. */
export const FORBIDDEN_UNSUPPORTED_CLAIM_PATTERNS: readonly RegExp[] = [
  /<\s*10\s*minutes/i,
  /\bROI\b/i,
  /\bhours?\s+saved\b/i,
  /\d+\s*%\s*(faster|reduction|savings|less)/i,
];
