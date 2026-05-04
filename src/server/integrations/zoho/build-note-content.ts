import type { ExtractionData } from "~/server/extraction/types";

const MAX_LEN = 30_000;

function topicLine(t: string | { title: string; description: string }): string {
  if (typeof t === "string") return t;
  return t.title + (t.description ? ` — ${t.description}` : "");
}

/**
 * Plain-text Zoho note: structured summary, flags, and action items (Epic 3.0a).
 * Does not log this string server-side; it is user data stored in the CRM.
 */
export function buildZohoCrmNoteContent(args: {
  meetUrl: string;
  clientLabel: string;
  meetingType: string;
  meetingDateIso: string;
  extraction: ExtractionData;
  flags: Array<{ type: string; severity: string; status: string }>;
}): string {
  const { meetUrl, clientLabel, meetingType, meetingDateIso, extraction, flags } = args;
  const lines: string[] = [
    "ComplyVault — compliance summary (auto-generated)",
    "",
    `Client / record label: ${clientLabel}`,
    `Meeting type: ${meetingType}`,
    `Meeting date: ${meetingDateIso}`,
    `ComplyVault link: ${meetUrl}`,
    "",
    "--- Topics ---",
    ...extraction.topics.map((t) => `• ${topicLine(t)}`),
    "",
    "--- Action items (follow-ups) ---",
    ...extraction.followUps.map(
      (f) => `• [${f.startTime != null ? `${f.startTime}s` : "time n/a"}] ${f.text}`
    ),
    "",
    "--- Recommendations ---",
    ...extraction.recommendations.map((r) => `• ${r.text}`),
    "",
    "--- Decisions ---",
    ...extraction.decisions.map((d) => `• ${d.text}`),
    "",
    "--- Flags (system + review) ---",
    ...flags.map(
      (fl) => `• [${fl.severity}] ${fl.type} — ${fl.status}`
    ),
  ];
  const body = lines.join("\n");
  if (body.length <= MAX_LEN) {
    return body;
  }
  return `${body.slice(0, MAX_LEN - 200)}\n\n… (truncated for Zoho field limits. Open ComplyVault for the full pack.)`;
}
