/**
 * EPIC-EA — shared evidence contracts for Release 1.
 * No unified table: adapters over Flag and other actionable sources.
 */

export type ComplianceItemCapability =
  | "reviewable"
  | "approvable"
  | "dismissible"
  | "assignable"
  | "none";

export type ComplianceItemKind =
  | "flag"
  | "parked_ingest"
  | "held_identity"
  | "evidence_gap"
  | "candidate_pack"
  | "coverage_gap";

export type ComplianceItemSeverity = "critical" | "high" | "medium" | "low";

export type EvidenceRefKind =
  | "email_message"
  | "meeting"
  | "meeting_offset"
  | "transcript_segment"
  | "document_version"
  | "policy_clause"
  | "regulatory_citation";

export type EvidenceRef = {
  kind: EvidenceRefKind;
  workspaceId: string;
  /** Email message / EvidenceItem id, meeting id, document version id, etc. */
  sourceId: string;
  threadId?: string;
  /** Seconds from meeting start when kind is meeting_offset / transcript_segment. */
  offsetSec?: number;
  segmentIndex?: number;
  documentVersionId?: string;
  policyClauseId?: string;
  regulatoryCitation?: string;
  sha256?: string;
  label?: string;
};

export type EvidenceRefResolveResult =
  | {
      status: "ok";
      href: string;
      title: string;
      sha256?: string;
    }
  | {
      status: "broken";
      reason: string;
    };

export type ChainStageState =
  | "complete"
  | "pending"
  | "missing"
  | "not_applicable";

export type ChainStage = {
  key:
    | "source"
    | "reason_surfaced"
    | "reviewer_decision"
    | "action_taken"
    | "closure_evidence";
  label: string;
  state: ChainStageState;
  at?: string;
  byUserId?: string;
  summary?: string;
  evidenceRef?: EvidenceRef;
};

export type ComplianceItem = {
  id: string;
  workspaceId: string;
  kind: ComplianceItemKind;
  title: string;
  summary: string;
  whyItMatters: string;
  whatIsMissing: string | null;
  expectedAction: string;
  dueAt: string | null;
  severity: ComplianceItemSeverity;
  ageDays: number;
  createdAt: string;
  capabilities: ComplianceItemCapability[];
  evidenceRefs: EvidenceRef[];
  chain: ChainStage[];
  /** Opaque source row id for adapters. */
  sourceId: string;
};
