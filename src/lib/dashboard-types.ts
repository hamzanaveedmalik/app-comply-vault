export type WeeklyFlagData = {
  week: string;
  count: number;
};

export type FlagCategoryData = {
  category: string;
  count: number;
  color: string;
};

export type MeetingTypeData = {
  type: string;
  count: number;
};

export type FinalizeTimeData = {
  date: string;
  days: number | null;
};

export type MeetingUiStatus = "draft" | "review" | "flagged" | "finalized";

export type MeetingRow = {
  id: string;
  clientName: string;
  meetingType: string;
  date: string;
  /** Denormalized UI status for badges */
  status: MeetingUiStatus;
  /** Human-readable status for accessibility */
  statusLabel: string;
  /** Raw Prisma status for polling */
  rawStatus: string;
  flagCount: number;
  /** CV-TR-16 */
  supersededById?: string | null;
  supersedesId?: string | null;
};

export type HealthTrendPoint = {
  /** Short label, e.g. "Apr" or "W3" */
  label: string;
  /** Reconstructed weekly health proxy (0–100) */
  score: number;
};

export type FlagActivityWeek = {
  week: string;
  opened: number;
  resolved: number;
};

export type FlagAgingBucket = {
  label: string;
  count: number;
  color: string;
};

export type FlagAging = {
  avgDaysOpen: number | null;
  buckets: FlagAgingBucket[];
  pastSla: number;
  slaDays: number;
};

export type DispositionSummary = {
  resolved: number;
  dismissed: number;
  escalated: number;
  /** 0–100; dismissed as a share of all dispositions */
  falsePositiveRate: number;
  trending: "up" | "down" | "flat";
};

export type FinalizeStripPoint = {
  meetingId: string;
  clientName: string;
  days: number;
  late: boolean;
};

export type FinalizeStrip = {
  points: FinalizeStripPoint[];
  targetDays: number;
  maxDays: number;
  /** Average time-to-finalize (days) for meetings finalized within the range */
  avgDays: number | null;
};

export type DashboardRange = "30d" | "90d" | "12m";

export const DASHBOARD_RANGES: readonly DashboardRange[] = ["30d", "90d", "12m"] as const;

export function isDashboardRange(value: unknown): value is DashboardRange {
  return value === "30d" || value === "90d" || value === "12m";
}

export type AuditReadiness = {
  ready: number;
  total: number;
  blocked: number;
  blockedReason: string | null;
};

export type AdvisorRow = {
  userId: string;
  name: string;
  /** Avatar image URL — the advisor's own image, or a deterministic face fallback */
  avatarUrl: string;
  /** Meetings this advisor has certified */
  certifiedCount: number;
  /** Open flags across this advisor's certified meetings */
  openFlags: number;
  /** Average time-to-finalize (days) for this advisor's finalized meetings */
  avgFinalizeDays: number | null;
  /** ISO date of most recent certification, or null */
  lastActivity: string | null;
  /** Certification activity per bucket across the range (for the sparkline) */
  trend: number[];
  trending: "up" | "down" | "flat";
};

export type ClientHealthRow = {
  clientName: string;
  /** Linked Client.id when Meeting.clientId is set (never matched by name). */
  clientId: string | null;
  health: number;
  coverageDone: number;
  coverageTotal: number;
  openFlags: number;
  /** ISO date of most recent meeting, or null */
  lastMeeting: string | null;
  /** ISO date of most recent meeting or email, whichever is later */
  lastActivity: string | null;
  /** Distinguishes meeting vs email for the Last activity cell */
  lastActivityType: "meeting" | "email" | null;
  /** 8 weekly points (relative activity) for the sparkline */
  trend: number[];
  trending: "up" | "down" | "flat";
};

export type DashboardSummary = {
  /** The time range this summary was computed for */
  range: DashboardRange;
  /** Human-readable range window, e.g. "Last 90 days" */
  rangeLabel: string;
  /** Caption for the health trend chart, e.g. "13-week trend" */
  trendCaption: string;

  healthScore: number;
  healthLabel: string;
  healthTrend: HealthTrendPoint[];
  healthDelta: number;
  healthBreakdown: {
    meetingCoverage: number;
    documentsFinalised: number;
    flagsResolved: number;
    signaturesComplete: number;
  };

  flagActivity: FlagActivityWeek[];
  flagsOpenedThisWeek: number;
  flagAging: FlagAging;
  dispositions: DispositionSummary;
  finalizeStrip: FinalizeStrip;
  auditReadiness: AuditReadiness;
  clients: ClientHealthRow[];
  advisors: AdvisorRow[];

  totalMeetings: number;
  pendingReview: number;
  openFlags: number;
  unfinalizedCount: number;
  flagsDelta: number;
  flagsTrending: "up" | "down" | "flat";
  finalizationRate: number;
  finalizedCount: number;
  avgTimeToFinalize: number | null;
  auditPacksGenerated: number;

  pipeline: {
    draft: number;
    review: number;
    flagged: number;
    finalized: number;
  };

  flagsTrend: WeeklyFlagData[];
  flagsByCategory: FlagCategoryData[];
  meetingsByType: MeetingTypeData[];
  finalizeTrend: FinalizeTimeData[];

  recentMeetings: MeetingRow[];
};
