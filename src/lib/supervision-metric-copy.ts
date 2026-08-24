/**
 * Help copy for supervision selectivity metrics (CV-SI-002).
 * Counts are triage signals for human review — not independent determinations.
 */

export type SupervisionMetricHelpKey =
  | "processed"
  | "cleared"
  | "routineSamples"
  | "priorityFindings"
  | "held"
  | "openRemediation";

export const SUPERVISION_METRIC_HELP: Record<SupervisionMetricHelpKey, string> = {
  processed:
    "Interactions (meetings and email threads) that have a recorded supervisory outcome.",
  cleared:
    "Interactions reviewed and closed without an active escalation — including parked items and closed escalations no longer in the Priority Inbox.",
  routineSamples:
    "Non-escalated interactions selected for control sampling to check whether material concerns were missed. Sampling alone does not create a priority finding.",
  priorityFindings:
    "Escalated interactions that still have an open, actionable finding requiring CCO review.",
  held:
    "Interactions paused because required context is missing (for example identity or source unavailable) before a disposition can be completed.",
  openRemediation:
    "Remediation tasks that are still open or in progress on findings that require follow-up.",
};
