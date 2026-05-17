import type { CmFlagDisposition, FlagStatus } from "../../generated/prisma";

/** Parse meeting.cmReviewSummary Json into counts for sign-off display. */
export function parseCmReviewSummary(raw: unknown): {
  resolved: number;
  noted: number;
  escalated: number;
} | null {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    return null;
  }
  const o = raw as Record<string, unknown>;
  const resolved = o.resolved;
  const noted = o.noted;
  const escalated = o.escalated;
  if (typeof resolved !== "number" || typeof noted !== "number" || typeof escalated !== "number") {
    return null;
  }
  return { resolved, noted, escalated };
}

/** Best-effort counts when cmReviewSummary json is missing (legacy data). */
export function computeCmReviewSummaryFromFlags(
  flags: Array<{ status: FlagStatus; cmDisposition: CmFlagDisposition }>,
): { resolved: number; noted: number; escalated: number } {
  let resolved = 0;
  let noted = 0;
  let escalated = 0;
  for (const f of flags) {
    if (f.cmDisposition === "NOTED") {
      noted += 1;
    } else if (f.cmDisposition === "ESCALATED" || f.status === "PENDING_VERIFICATION") {
      escalated += 1;
    } else if (
      f.cmDisposition === "RESOLVED" ||
      f.status === "CLOSED" ||
      f.status === "CLOSED_ACCEPTED_RISK"
    ) {
      resolved += 1;
    }
  }
  return { resolved, noted, escalated };
}
