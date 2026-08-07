import { describe, expect, it } from "vitest";
import {
  ADVIZORSTACK_EXPECTED_COUNTS,
  ADVIZORSTACK_FIRMS,
  ADVIZORSTACK_ROLLOVER_FLAGS,
  expectedMeetingIdsForFirm,
  expectedPortfolioMeetingTotal,
  isAdvizorStackFirmWorkspaceId,
} from "./advizorstack-tenant";
import { portfolioTestHelpers } from "./portfolio";

describe("CV-SI-029 AdvizorStack tenant registry", () => {
  it("defines three named firms with portfolio meeting total 147", () => {
    expect(ADVIZORSTACK_FIRMS).toHaveLength(3);
    expect(ADVIZORSTACK_FIRMS.map((f) => f.name)).toEqual([
      "Secure Investment Management",
      "Desert Ridge Wealth",
      "Northstar Advisory",
    ]);
    expect(expectedPortfolioMeetingTotal()).toBe(
      ADVIZORSTACK_EXPECTED_COUNTS.totalProcessed,
    );
  });

  it("splits cleared / sampled / escalated to Epic 1 selectivity totals", () => {
    const cleared = ADVIZORSTACK_FIRMS.reduce((sum, f) => sum + f.cleared, 0);
    const sampled = ADVIZORSTACK_FIRMS.reduce((sum, f) => sum + f.sampled, 0);
    expect(cleared).toBe(ADVIZORSTACK_EXPECTED_COUNTS.clearedOrDeprioritised);
    expect(sampled).toBe(ADVIZORSTACK_EXPECTED_COUNTS.routineSamples);
    expect(ADVIZORSTACK_FIRMS).toHaveLength(
      ADVIZORSTACK_EXPECTED_COUNTS.priorityFindings,
    );
  });

  it("uses stable meeting ids per firm", () => {
    const secure = ADVIZORSTACK_FIRMS[0]!;
    const ids = expectedMeetingIdsForFirm(secure);
    expect(ids).toContain("si-as-sec-mtg-001");
    expect(ids).toContain("si-as-sec-mtg-pri-001");
    expect(ids).toHaveLength(secure.cleared + secure.sampled + 1);
  });

  it("seeds seven rollover findings and four remediation tasks", () => {
    expect(ADVIZORSTACK_ROLLOVER_FLAGS).toHaveLength(
      ADVIZORSTACK_EXPECTED_COUNTS.rolloverFindings,
    );
    const tasks = ADVIZORSTACK_ROLLOVER_FLAGS.filter((f) => f.withTask);
    expect(tasks).toHaveLength(ADVIZORSTACK_EXPECTED_COUNTS.openRemediation);
    expect(isAdvizorStackFirmWorkspaceId("si-as-ws-secure")).toBe(true);
    expect(isAdvizorStackFirmWorkspaceId("other")).toBe(false);
  });
});

describe("CV-SI-004 portfolio aggregation helpers", () => {
  it("sums firm counts into portfolio selectivity", () => {
    const counts = portfolioTestHelpers.sumCounts([
      {
        totalProcessed: 53,
        clearedOrDeprioritised: 50,
        routineSamples: 2,
        priorityFindings: 1,
        heldInteractions: 0,
        openRemediation: 2,
      },
      {
        totalProcessed: 48,
        clearedOrDeprioritised: 45,
        routineSamples: 2,
        priorityFindings: 1,
        heldInteractions: 0,
        openRemediation: 1,
      },
      {
        totalProcessed: 46,
        clearedOrDeprioritised: 44,
        routineSamples: 1,
        priorityFindings: 1,
        heldInteractions: 0,
        openRemediation: 1,
      },
    ]);

    expect(counts).toEqual({
      totalProcessed: 147,
      clearedOrDeprioritised: 139,
      routineSamples: 5,
      priorityFindings: 3,
      heldInteractions: 0,
      openRemediation: 4,
    });
    expect(
      portfolioTestHelpers.buildSelectivityStatement(
        counts.priorityFindings,
        counts.totalProcessed,
      ),
    ).toBe("3 findings require review from 147 processed interactions.");
  });

  it("returns empty counts when the caller has no authorised firms", () => {
    expect(portfolioTestHelpers.emptyCounts().totalProcessed).toBe(0);
  });
});
