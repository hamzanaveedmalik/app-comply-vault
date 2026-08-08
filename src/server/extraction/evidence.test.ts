import { describe, expect, it } from "vitest";
import { asEvidenceMapItems, validateEvidenceCoverage } from "./evidence";

describe("asEvidenceMapItems", () => {
  it("returns an empty array when evidenceMap is a plain object", () => {
    expect(asEvidenceMapItems({})).toEqual([]);
  });

  it("returns the array when evidenceMap is already a list", () => {
    const items = [
      {
        field: "disclosure" as const,
        claim: "Fee schedule reviewed",
        startTime: 12,
        endTime: 40,
        snippet: "We reviewed the fee schedule.",
        confidence: 0.9,
        edited: false,
      },
    ];
    expect(asEvidenceMapItems(items)).toEqual(items);
  });
});

describe("validateEvidenceCoverage", () => {
  it("does not throw when evidenceMap is not an array", () => {
    expect(validateEvidenceCoverage({})).toEqual({
      valid: true,
      coverage: 1,
      totalClaims: 0,
      validClaims: 0,
    });
  });
});
