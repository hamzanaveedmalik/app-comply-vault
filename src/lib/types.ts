/** Workspace dropdown & shell — aligned with dashboard workspace UI spec. */
export type Workspace = {
  id: string;
  initials: string;
  name: string;
  clientCount: number;
  role: string;
};

export type TeamMember = {
  id: string;
  initials: string;
  name: string;
  role: string;
  status: "online" | "away" | "offline";
  avatarColor: string;
};

export type SupervisoryOutcome =
  | "CLEARED"
  | "ROUTINE_SAMPLE"
  | "ESCALATED"
  | "HELD"
  | "PARKED";

export type SupervisionCounts = {
  totalProcessed: number;
  clearedOrDeprioritised: number;
  routineSamples: number;
  priorityFindings: number;
  heldInteractions: number;
  openRemediation: number;
};

export type SupervisionSummary = {
  counts: SupervisionCounts;
  selectivityStatement: string;
};

export type FirmSupervisionRow = {
  firmId: string;
  firmName: string;
  processedInteractions: number;
  priorityFindings: number;
  openRemediation: number;
  oldestUnresolvedFindingAt: string | null;
  topControlConcern: string | null;
  trend: "increasing" | "stable" | "decreasing" | "insufficient_data";
  coverageStatus: "covered" | "partial" | "gap";
  href: string;
};

export type SupervisionPatternDto = {
  id: string;
  title: string;
  summary: string;
  controlArea: string;
  firmsAffected: number;
  openFindings: number;
  href: string;
};

export type SupervisionFilterOption = {
  id: string;
  label: string;
};

export type PortfolioSupervisionSummary = {
  synthetic: boolean;
  counts: SupervisionCounts;
  selectivityStatement: string;
  firms: FirmSupervisionRow[];
  patterns: SupervisionPatternDto[];
  filterOptions: {
    firms: SupervisionFilterOption[];
    advisers: SupervisionFilterOption[];
  };
};

export type SupervisoryInteractionDto = {
  id: string;
  channel: "MEETING" | "EMAIL";
  title: string;
  occurredAt: string | null;
  processedAt: string | null;
  supervisoryOutcome: SupervisoryOutcome;
  outcomeReason: string | null;
  outcomeConfidence: number | null;
  primaryControlId: string | null;
  heldReason: string | null;
  parkedReason: string | null;
  href: string;
};

export type PriorityInboxTab =
  | "unassigned"
  | "assigned"
  | "in_review"
  | "remediation"
  | "escalated"
  | "closed";

export type PriorityInboxFindingDto = {
  id: string;
  title: string;
  firmId: string;
  firmName: string;
  adviserId: string | null;
  adviserName: string | null;
  clientName: string | null;
  channels: Array<"MEETING" | "EMAIL">;
  primaryControl: string;
  policyMappingCode: string;
  escalationReason: string;
  severity: "INFO" | "WARN" | "CRITICAL";
  materiality: "HIGH" | "MEDIUM" | "LOW";
  confidence: number | null;
  dueAt: string | null;
  ownerId: string | null;
  ownerName: string | null;
  repeatAdviser: boolean;
  evidenceCount: number;
  status: "OPEN" | "IN_REMEDIATION" | "PENDING_VERIFICATION" | "CLOSED" | "CLOSED_ACCEPTED_RISK";
  tab: PriorityInboxTab;
  href: string;
};

export type PriorityInboxCounts = Record<PriorityInboxTab, number>;

export type PriorityInboxDto = {
  tab: PriorityInboxTab;
  findings: PriorityInboxFindingDto[];
  tabCounts: PriorityInboxCounts;
  header: {
    priorityFindings: number;
    totalProcessed: number;
    selectivityStatement: string;
  };
};

export type SupervisorySamplingConfigDto = {
  workspaceId: string;
  randomPercentage: number;
  adviserRiskEnabled: boolean;
  adviserRiskOpenFlagFloor: number;
  newAdviserEnabled: boolean;
  newAdviserWindowDays: number;
  timeSinceLastReviewEnabled: boolean;
  reviewStalenessDays: number;
  manualSelectionEnabled: boolean;
  controlSamplingPolicy: Record<string, number>;
};
