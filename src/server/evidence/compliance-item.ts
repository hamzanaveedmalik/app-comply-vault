/**
 * CV-EA-01 — Unified ComplianceItem contract via adapters.
 * Generic surfaces render only declared capabilities.
 */

import type {
  ChainStage,
  ComplianceItem,
  ComplianceItemCapability,
  ComplianceItemSeverity,
  EvidenceRef,
} from "./types";

export type FlagLike = {
  id: string;
  workspaceId: string;
  type: string;
  severity: string;
  status: string;
  sourceType: "MEETING" | "EMAIL";
  sourceId: string;
  meetingId: string | null;
  communicationId: string | null;
  createdAt: Date;
  resolvedAt: Date | null;
  resolvedByUserId: string | null;
  resolutionNote: string | null;
  cmTriageNote: string | null;
};

function daysSince(isoOrDate: Date | string, now: Date): number {
  const t = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  return Math.max(0, Math.floor((now.getTime() - t.getTime()) / 86_400_000));
}

function flagCapabilities(flag: FlagLike): ComplianceItemCapability[] {
  if (flag.status === "OPEN" || flag.status === "IN_REMEDIATION") {
    return ["reviewable", "dismissible", "assignable"];
  }
  if (flag.status === "PENDING_VERIFICATION") {
    return ["reviewable", "approvable"];
  }
  return ["none"];
}

function flagSeverity(severity: string): ComplianceItemSeverity {
  if (severity === "CRITICAL") return "critical";
  if (severity === "WARN") return "high";
  return "medium";
}

function flagSummary(flag: FlagLike): string {
  return (
    flag.cmTriageNote ??
    flag.resolutionNote ??
    `${flag.type} (${flag.severity})`
  );
}

function flagEvidenceRefs(flag: FlagLike): EvidenceRef[] {
  const refs: EvidenceRef[] = [];
  if (flag.sourceType === "EMAIL") {
    refs.push({
      kind: "email_message",
      workspaceId: flag.workspaceId,
      sourceId: flag.communicationId ?? flag.sourceId,
      threadId: flag.sourceId,
      label: "Email evidence",
    });
  }
  if (flag.sourceType === "MEETING" && (flag.meetingId || flag.sourceId)) {
    refs.push({
      kind: "meeting",
      workspaceId: flag.workspaceId,
      sourceId: flag.meetingId ?? flag.sourceId,
      label: "Meeting evidence",
    });
  }
  return refs;
}

function flagChain(flag: FlagLike): ChainStage[] {
  const created = flag.createdAt.toISOString();
  const open =
    flag.status === "OPEN" ||
    flag.status === "IN_REMEDIATION" ||
    flag.status === "PENDING_VERIFICATION";
  return [
    {
      key: "source",
      label: "Source",
      state: "complete",
      at: created,
      summary:
        flag.sourceType === "EMAIL" ? "Email correspondence" : "Meeting record",
      evidenceRef: flagEvidenceRefs(flag)[0],
    },
    {
      key: "reason_surfaced",
      label: "Reason surfaced",
      state: "complete",
      at: created,
      summary: flagSummary(flag),
    },
    {
      key: "reviewer_decision",
      label: "Reviewer decision",
      state: open ? "pending" : flag.resolvedAt ? "complete" : "missing",
      at: flag.resolvedAt?.toISOString(),
      byUserId: flag.resolvedByUserId ?? undefined,
      summary: flag.status,
    },
    {
      key: "action_taken",
      label: "Action taken",
      state:
        flag.status === "CLOSED" || flag.status === "CLOSED_ACCEPTED_RISK"
          ? "complete"
          : flag.status === "OPEN"
            ? "not_applicable"
            : "pending",
      at: flag.resolvedAt?.toISOString(),
      byUserId: flag.resolvedByUserId ?? undefined,
    },
    {
      key: "closure_evidence",
      label: "Closure evidence",
      state:
        flag.status === "CLOSED" || flag.status === "CLOSED_ACCEPTED_RISK"
          ? "complete"
          : "pending",
      at: flag.resolvedAt?.toISOString(),
    },
  ];
}

/** Adapter: Flag → ComplianceItem. */
export function complianceItemFromFlag(
  flag: FlagLike,
  now: Date = new Date()
): ComplianceItem {
  const open =
    flag.status === "OPEN" ||
    flag.status === "IN_REMEDIATION" ||
    flag.status === "PENDING_VERIFICATION";
  return {
    id: `flag:${flag.id}`,
    workspaceId: flag.workspaceId,
    kind: "flag",
    title: flag.type.replace(/_/g, " "),
    summary: flagSummary(flag),
    whyItMatters: "Open triage signal pending human review before any finding.",
    whatIsMissing: open ? "Reviewer decision" : null,
    expectedAction: "Review and dismiss, escalate, or resolve with a reason.",
    dueAt: null,
    severity: flagSeverity(flag.severity),
    ageDays: daysSince(flag.createdAt, now),
    createdAt: flag.createdAt.toISOString(),
    capabilities: flagCapabilities(flag),
    evidenceRefs: flagEvidenceRefs(flag),
    chain: flagChain(flag),
    sourceId: flag.id,
  };
}

export type ParkedIngestLike = {
  id: string;
  workspaceId: string;
  status: string;
  source: string;
  createdAt: Date;
  parkedAt?: Date;
  resolvedAt?: Date | null;
};

/** Adapter: ParkedIngest → ComplianceItem. */
export function complianceItemFromParkedIngest(
  row: ParkedIngestLike,
  now: Date = new Date()
): ComplianceItem {
  const created = row.parkedAt ?? row.createdAt;
  return {
    id: `parked:${row.id}`,
    workspaceId: row.workspaceId,
    kind: "parked_ingest",
    title: "Ingest refused — media posture",
    summary: `Parked ${row.source} ingest — no media posture decision.`,
    whyItMatters:
      "Fail-closed: source media was not retained or processed until the CCO decides posture.",
    whatIsMissing: "Media posture decision or manual replay",
    expectedAction: "Set media posture, then replay or discard the parked item.",
    dueAt: null,
    severity: "critical",
    ageDays: daysSince(created, now),
    createdAt: created.toISOString(),
    capabilities: ["reviewable"],
    evidenceRefs: [],
    chain: [
      {
        key: "source",
        label: "Source",
        state: "complete",
        at: created.toISOString(),
        summary: row.source,
      },
      {
        key: "reason_surfaced",
        label: "Reason surfaced",
        state: "complete",
        at: created.toISOString(),
        summary: "Media posture not set",
      },
      {
        key: "reviewer_decision",
        label: "Reviewer decision",
        state: row.status === "PARKED" ? "pending" : "complete",
        at: row.resolvedAt?.toISOString(),
      },
      {
        key: "action_taken",
        label: "Action taken",
        state:
          row.status === "INGESTED" || row.status === "DISCARDED"
            ? "complete"
            : "pending",
      },
      {
        key: "closure_evidence",
        label: "Closure evidence",
        state: row.status === "PARKED" ? "missing" : "complete",
      },
    ],
    sourceId: row.id,
  };
}

export type HeldIdentityLike = {
  id: string;
  workspaceId: string;
  addressOrName: string;
  method: string;
  confidence: string;
  createdAt: Date;
  meetingId?: string | null;
};

/** Adapter: held identity / triage → ComplianceItem. */
export function complianceItemFromHeldIdentity(
  row: HeldIdentityLike,
  now: Date = new Date()
): ComplianceItem {
  return {
    id: `held:${row.id}`,
    workspaceId: row.workspaceId,
    kind: "held_identity",
    title: "Identity held for confirmation",
    summary: `${row.addressOrName} (${row.method}, ${row.confidence})`,
    whyItMatters:
      "Low-confidence attribution is never silently accepted as client linkage.",
    whatIsMissing: "CCO confirmation of client identity",
    expectedAction: "Confirm or reject the proposed client match.",
    dueAt: null,
    severity: "high",
    ageDays: daysSince(row.createdAt, now),
    createdAt: row.createdAt.toISOString(),
    capabilities: ["reviewable", "assignable"],
    evidenceRefs: row.meetingId
      ? [
          {
            kind: "meeting",
            workspaceId: row.workspaceId,
            sourceId: row.meetingId,
          },
        ]
      : [],
    chain: [
      {
        key: "source",
        label: "Source",
        state: "complete",
        at: row.createdAt.toISOString(),
      },
      {
        key: "reason_surfaced",
        label: "Reason surfaced",
        state: "complete",
        summary: `Held: ${row.method} / ${row.confidence}`,
      },
      {
        key: "reviewer_decision",
        label: "Reviewer decision",
        state: "pending",
      },
      {
        key: "action_taken",
        label: "Action taken",
        state: "pending",
      },
      {
        key: "closure_evidence",
        label: "Closure evidence",
        state: "pending",
      },
    ],
    sourceId: row.id,
  };
}

export type CandidatePackLike = {
  id: string;
  workspaceId: string;
  requestText: string;
  status: string;
  createdAt: Date;
  confirmedAt?: Date | null;
};

export function complianceItemFromCandidatePack(
  row: CandidatePackLike,
  now: Date = new Date()
): ComplianceItem {
  const awaitingConfirm = row.status === "DRAFT_SCOPE";
  return {
    id: `pack:${row.id}`,
    workspaceId: row.workspaceId,
    kind: "candidate_pack",
    title: awaitingConfirm
      ? "Candidate pack awaiting scope confirmation"
      : "Candidate pack awaiting approval",
    summary: row.requestText.slice(0, 160),
    whyItMatters:
      "Nothing generates before the CCO confirms interpreted scope.",
    whatIsMissing: awaitingConfirm
      ? "Scope confirmation"
      : "Pack approval for export",
    expectedAction: awaitingConfirm
      ? "Confirm or edit the interpreted scope."
      : "Review coverage statement and approve the candidate pack.",
    dueAt: null,
    severity: "medium",
    ageDays: daysSince(row.createdAt, now),
    createdAt: row.createdAt.toISOString(),
    capabilities: ["reviewable", "approvable"],
    evidenceRefs: [],
    chain: [
      {
        key: "source",
        label: "Source",
        state: "complete",
        at: row.createdAt.toISOString(),
        summary: "Document-request item",
      },
      {
        key: "reason_surfaced",
        label: "Reason surfaced",
        state: "complete",
        summary: "Scope interpretation proposed",
      },
      {
        key: "reviewer_decision",
        label: "Reviewer decision",
        state: row.confirmedAt ? "complete" : "pending",
        at: row.confirmedAt?.toISOString(),
      },
      {
        key: "action_taken",
        label: "Action taken",
        state: row.status === "APPROVED" ? "complete" : "pending",
      },
      {
        key: "closure_evidence",
        label: "Closure evidence",
        state: row.status === "APPROVED" ? "complete" : "pending",
      },
    ],
    sourceId: row.id,
  };
}

/** Only actions declared on the item are valid. */
export function itemAllows(
  item: ComplianceItem,
  capability: import("./types").ComplianceItemCapability
): boolean {
  if (capability === "none") return false;
  return item.capabilities.includes(capability);
}

const SEVERITY_RANK: Record<
  import("./types").ComplianceItemSeverity,
  number
> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

/** Severity then age (oldest first within severity). */
export function sortComplianceItems(items: ComplianceItem[]): ComplianceItem[] {
  return [...items].sort((a, b) => {
    const sev = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
    if (sev !== 0) return sev;
    return b.ageDays - a.ageDays;
  });
}
