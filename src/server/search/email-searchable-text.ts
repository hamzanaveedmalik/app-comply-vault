/**
 * Generic searchable-text helpers for Ask / keyword retrieval.
 * Meetings use Meeting.searchableText; email uses EvidenceItem.searchableText
 * populated from redacted body only (never raw PII to the index or LLM).
 */

import { redactForLlm } from "~/server/classification/redaction-guard";

const MAX_SEARCHABLE_TEXT_LENGTH = 50 * 1024;

function truncateSearchable(text: string): string {
  const normalized = text.replace(/\s+/g, " ").trim().toLowerCase();
  if (normalized.length <= MAX_SEARCHABLE_TEXT_LENGTH) return normalized;
  return normalized.substring(0, MAX_SEARCHABLE_TEXT_LENGTH);
}

/**
 * Build keyword index text for an email message. Always redacts first.
 */
export function generateEmailSearchableText(input: {
  bodyText: string;
  fromAddress: string;
  toAddresses: string[];
  subject?: string | null;
  direction?: string;
  classificationCategories?: string[];
}): { searchableText: string; contentHash: string } {
  const redacted = redactForLlm({
    bodyText: input.bodyText,
    fromAddress: input.fromAddress,
    toAddresses: input.toAddresses,
  });

  const parts: string[] = [];
  if (input.subject) parts.push(input.subject);
  if (input.direction) parts.push(input.direction);
  parts.push(redacted.text);
  if (input.classificationCategories?.length) {
    parts.push(input.classificationCategories.join(" "));
  }

  return {
    searchableText: truncateSearchable(parts.join(" ")),
    contentHash: redacted.contentHash,
  };
}
