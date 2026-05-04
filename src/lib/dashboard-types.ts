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
};

export type DashboardSummary = {
  healthScore: number;
  healthBreakdown: {
    meetingCoverage: number;
    documentsFinalised: number;
    flagsResolved: number;
    signaturesComplete: number;
  };

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
