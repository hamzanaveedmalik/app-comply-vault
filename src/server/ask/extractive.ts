/**
 * Grounded extractive answers — cite only retrieved snippets + hashes.
 * Used for RIACT Moment C rehearsal and as LLM-failure fallback so demos
 * still show hashes without inventing facts.
 */

import type { ScoredEvidence } from "./types";

function formatWhen(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function clipSnippet(text: string, max = 180): string {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (cleaned.length <= max) return cleaned;
  return `${cleaned.slice(0, max - 1)}…`;
}

/**
 * Build a short answer that only restates retrieved evidence with hashes.
 */
export function buildExtractiveAnswer(
  evidence: ScoredEvidence[],
): string {
  const lines = evidence.slice(0, 4).map((row) => {
    const c = row.candidate;
    const channel = c.sourceType === "EMAIL" ? "Email" : "Meeting";
    const hash = c.contentSha256
      ? ` · ${c.contentSha256.slice(0, 8)}…`
      : "";
    const snippet =
      row.excerpts[0]?.text?.trim() ||
      c.searchableText?.slice(0, 180) ||
      "Record on file";
    return `${formatWhen(c.meetingDate)} · ${channel} · ${c.clientName}${hash}\n“${clipSnippet(snippet)}”`;
  });

  return (
    "From indexed records matching this question:\n\n" + lines.join("\n\n")
  );
}
