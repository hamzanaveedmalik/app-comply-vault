/**
 * RIACT partner portfolio snapshots — fixture-only, no cross-workspace reads.
 */

import type { PartnerFirmSnapshot } from "~/server/partner/snapshots";
import {
  RIACT_CLIENT_FIRMS,
  RIACT_COVERAGE_GAP,
  RIACT_SMS_SOURCE,
  riactPrimaryWorkspaceId,
} from "~/server/demo/riact/tenant";

export const RIACT_PARTNER_FIRM_SNAPSHOTS: PartnerFirmSnapshot[] = [
  {
    firmId: "riact-snap-cactus",
    displayName: RIACT_CLIENT_FIRMS[0]!.name,
    coverageCompleteness: 74,
    overdueItems: 3,
    oldestItemDays: 12,
    evidenceGaps: [
      {
        channel: "EMAIL",
        from: RIACT_COVERAGE_GAP.from,
        to: RIACT_COVERAGE_GAP.to,
        detail: RIACT_COVERAGE_GAP.reason,
      },
      {
        channel: "SMS",
        from: "2025-11-23",
        to: "2026-08-23",
        detail: RIACT_SMS_SOURCE.reason,
      },
    ],
    lastIngestionAt: "2026-08-22T18:00:00.000Z",
    contributingFactors: [
      "Meeting coverage 78% (weight 30%)",
      "Documents finalised 76% (weight 25%)",
      "Flags resolved 71% (weight 25%)",
      "Signatures complete 69% (weight 20%)",
      "SEC document request in progress",
      "SMS channel registered but unindexed",
    ],
    drillsIntoDemoWorkspace: true,
  },
  {
    firmId: "riact-snap-vermillion",
    displayName: RIACT_CLIENT_FIRMS[1]!.name,
    coverageCompleteness: 88,
    overdueItems: 1,
    oldestItemDays: 6,
    evidenceGaps: [],
    lastIngestionAt: "2026-08-21T12:00:00.000Z",
    contributingFactors: [
      "Meeting coverage 90% (weight 30%)",
      "Documents finalised 87% (weight 25%)",
      "Flags resolved 89% (weight 25%)",
      "Signatures complete 86% (weight 20%)",
    ],
    drillsIntoDemoWorkspace: false,
  },
  {
    firmId: "riact-snap-pinal",
    displayName: RIACT_CLIENT_FIRMS[2]!.name,
    coverageCompleteness: 81,
    overdueItems: 2,
    oldestItemDays: 9,
    evidenceGaps: [],
    lastIngestionAt: "2026-08-20T09:00:00.000Z",
    contributingFactors: [
      "Meeting coverage 83% (weight 30%)",
      "Documents finalised 80% (weight 25%)",
      "Flags resolved 82% (weight 25%)",
      "Signatures complete 79% (weight 20%)",
    ],
    drillsIntoDemoWorkspace: false,
  },
];

export function riactPrimaryWorkspaceForDrillIn(): string {
  return riactPrimaryWorkspaceId();
}
