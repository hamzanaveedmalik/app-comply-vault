/**
 * Regulatory-citation post-filter (PRD §6.2).
 *
 * Even though the system prompt forbids citing CFR sections / SEC rules, we
 * scan the LLM output for the same patterns as a defence-in-depth. Any match
 * causes the answer to be discarded and replaced with the pre-approved
 * `BLOCKED_REGULATORY_ANSWER` string.
 *
 * Conservative by design — false positives are acceptable (rephrase prompt
 * to the user), false negatives are not (a hallucinated CFR reference can
 * mislead a regulator).
 */

const BANNED_PATTERNS: ReadonlyArray<RegExp> = [
  // 17 CFR §275 / 17 C.F.R. 275
  /\b\d+\s*C\.?\s*F\.?\s*R\.?\s*§?\s*\d+/i,
  // Rule 206(4)-7, Rule 204-2
  /\bRule\s+\d{3}(?:\(\w+\))?\s*[-–]\s*\d+\b/i,
  // Section 206(4), Section 204(a)(1)
  /\bSection\s+\d+\s*(?:\([a-z0-9]+\))+/i,
  // Advisers Act § / Securities Exchange Act §
  /\b(?:Advisers Act|Investment Advisers Act|Securities Exchange Act|Investment Company Act)\b/i,
  // Form ADV references with item numbers ("ADV Part 2A Item 5")
  /\bADV\s+Part\s+\d+[A-Z]?\s+Item\s+\d+/i,
];

export type RegulatoryScanResult =
  | { blocked: false }
  | { blocked: true; matchedPattern: string };

export function scanForRegulatoryCitations(
  answer: string
): RegulatoryScanResult {
  for (const pattern of BANNED_PATTERNS) {
    const match = pattern.exec(answer);
    if (match) {
      return { blocked: true, matchedPattern: pattern.source };
    }
  }
  return { blocked: false };
}
