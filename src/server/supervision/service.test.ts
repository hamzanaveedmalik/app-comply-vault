import { describe, expect, it } from "vitest";
import { supervisionTestHelpers } from "./service";

describe("supervision summary helpers", () => {
  it("builds the seeded selectivity counts", () => {
    const rows = [
      ...Array.from({ length: 139 }, (_, i) => ({
        id: `c${i}`,
        channel: "MEETING" as const,
        outcome: "CLEARED" as const,
      })),
      ...Array.from({ length: 5 }, (_, i) => ({
        id: `s${i}`,
        channel: "MEETING" as const,
        outcome: "ROUTINE_SAMPLE" as const,
      })),
      ...Array.from({ length: 3 }, (_, i) => ({
        id: `e${i}`,
        channel: "MEETING" as const,
        outcome: "ESCALATED" as const,
      })),
    ];

    const summary = supervisionTestHelpers.summarizeOutcomes(
      rows,
      4,
      new Set(["e0", "e1", "e2"]),
    );

    expect(summary.counts).toEqual({
      totalProcessed: 147,
      clearedOrDeprioritised: 139,
      routineSamples: 5,
      priorityFindings: 3,
      heldInteractions: 0,
      openRemediation: 4,
    });
    expect(summary.selectivityStatement).toBe(
      "3 findings require review from 147 processed interactions.",
    );
  });

  it("excludes closed escalations from priority findings count", () => {
    const summary = supervisionTestHelpers.summarizeOutcomes(
      [
        { id: "open", channel: "MEETING", outcome: "ESCALATED" },
        { id: "closed", channel: "MEETING", outcome: "ESCALATED" },
      ],
      0,
      new Set(["open"]),
    );

    expect(summary.counts.priorityFindings).toBe(1);
    expect(summary.counts.clearedOrDeprioritised).toBe(1);
    expect(summary.counts.totalProcessed).toBe(2);
  });

  it("counts held items separately from cleared items", () => {
    const summary = supervisionTestHelpers.summarizeOutcomes(
      [
        { id: "1", channel: "MEETING", outcome: "CLEARED" },
        { id: "2", channel: "MEETING", outcome: "HELD" },
        { id: "3", channel: "MEETING", outcome: "HELD" },
        { id: "4", channel: "MEETING", outcome: "ESCALATED" },
      ],
      0,
      new Set(["4"]),
    );

    expect(summary.counts.totalProcessed).toBe(4);
    expect(summary.counts.clearedOrDeprioritised).toBe(1);
    expect(summary.counts.heldInteractions).toBe(2);
    expect(summary.counts.priorityFindings).toBe(1);
  });

  it("normalizes invalid control sampling values", () => {
    expect(
      supervisionTestHelpers.parseControlSamplingPolicy({
        fees: 110,
        rollover: 5.4,
        bad: "nope",
      }),
    ).toEqual({
      fees: 100,
      rollover: 5,
    });
  });

  it("requires a parked reason", () => {
    expect(() => supervisionTestHelpers.requireParkedReason("")).toThrow(
      /Parked interactions require a recorded reason/,
    );
    expect(supervisionTestHelpers.requireParkedReason("  Media posture  ")).toBe(
      "Media posture",
    );
  });

  it("treats outcome values as mutually exclusive labels", () => {
    expect(
      supervisionTestHelpers.outcomesAreMutuallyExclusive("CLEARED", "ESCALATED"),
    ).toBe(true);
    expect(
      supervisionTestHelpers.outcomesAreMutuallyExclusive("CLEARED", "CLEARED"),
    ).toBe(true);
  });
});
