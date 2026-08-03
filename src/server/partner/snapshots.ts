/**
 * CV-PV-01s — Demo-only partner portfolio snapshots.
 * No cross-workspace read path. Seeded fixtures only.
 */

export type EvidenceGap = {
  channel: string;
  from: string;
  to: string;
  detail: string;
};

export type PartnerFirmSnapshot = {
  firmId: string;
  displayName: string;
  coverageCompleteness: number;
  overdueItems: number;
  oldestItemDays: number;
  evidenceGaps: EvidenceGap[];
  lastIngestionAt: string | null;
  contributingFactors: string[];
  /** When true, UI may drill into the live demo workspace Needs Attention. */
  drillsIntoDemoWorkspace: boolean;
};

/**
 * Three representative firms with distinct exposure profiles.
 * Reuses Compliance Health Score factor language — nothing invented as a
 * second scoring model. Factors mirror healthBreakdown weights conceptually.
 */
export const PARTNER_FIRM_SNAPSHOTS: PartnerFirmSnapshot[] = [
  {
    firmId: "snap-firm-healthy",
    displayName: "Cedar Ridge Advisors",
    coverageCompleteness: 92,
    overdueItems: 1,
    oldestItemDays: 4,
    evidenceGaps: [],
    lastIngestionAt: "2026-07-29T18:00:00.000Z",
    contributingFactors: [
      "Meeting coverage 94% (weight 30%)",
      "Documents finalised 90% (weight 25%)",
      "Flags resolved 96% (weight 25%)",
      "Signatures complete 88% (weight 20%)",
    ],
    drillsIntoDemoWorkspace: false,
  },
  {
    firmId: "snap-firm-demo",
    displayName: "Summit Ridge Advisors, LLC",
    coverageCompleteness: 71,
    overdueItems: 6,
    oldestItemDays: 18,
    evidenceGaps: [
      {
        channel: "EMAIL",
        from: "2024-01-01",
        to: "2024-03-31",
        detail: "Mailbox not connected for Q1 2024",
      },
      {
        channel: "SMS",
        from: "2025-01-01",
        to: "2026-07-30",
        detail: "SMS channel unindexed",
      },
    ],
    lastIngestionAt: "2026-07-28T12:00:00.000Z",
    contributingFactors: [
      "Meeting coverage 68% (weight 30%)",
      "Documents finalised 74% (weight 25%)",
      "Flags resolved 70% (weight 25%)",
      "Signatures complete 72% (weight 20%)",
      "Open parked ingest awaiting media posture",
      "Held identities pending CCO confirmation",
    ],
    drillsIntoDemoWorkspace: true,
  },
  {
    firmId: "snap-firm-exposed",
    displayName: "Northline Wealth",
    coverageCompleteness: 48,
    overdueItems: 14,
    oldestItemDays: 41,
    evidenceGaps: [
      {
        channel: "MEETING",
        from: "2026-05-01",
        to: "2026-06-15",
        detail: "Zoom disconnect — meetings not ingested",
      },
      {
        channel: "EMAIL",
        from: "2026-06-01",
        to: "2026-07-15",
        detail: "M365 sync stalled",
      },
    ],
    lastIngestionAt: "2026-06-20T09:00:00.000Z",
    contributingFactors: [
      "Meeting coverage 42% (weight 30%)",
      "Documents finalised 51% (weight 25%)",
      "Flags resolved 45% (weight 25%)",
      "Signatures complete 55% (weight 20%)",
      "Ingestion gap > 30 days",
      "Unresolved CRITICAL flags ageing past SLA",
    ],
    drillsIntoDemoWorkspace: false,
  },
];

export function listPartnerFirmSnapshots(): PartnerFirmSnapshot[] {
  return PARTNER_FIRM_SNAPSHOTS.map((s) => ({ ...s }));
}

/**
 * Isolation guarantee for Release 1: this module never accepts a workspaceId
 * to query another tenant's rows. Snapshots are fixtures only.
 */
export function assertNoCrossWorkspaceRead(): {
  crossWorkspaceReadPath: false;
} {
  return { crossWorkspaceReadPath: false };
}
