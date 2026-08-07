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

export type PortfolioSupervisionSummary = {
  synthetic: boolean;
  counts: SupervisionCounts;
  selectivityStatement: string;
  firms: FirmSupervisionRow[];
  patterns: SupervisionPatternDto[];
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
