import { describe, expect, it } from "vitest";
import { deriveRiskFlags, getRiskFlagVariant, sortRiskFlags } from "~/lib/risk-flags";

describe("deriveRiskFlags", () => {
  it("derives all five flag types from ADV Part 1A fields", () => {
    const flags = deriveRiskFlags({
      Item11D: { Q11D2: "Y" },
      Item7A: { Q7A12: "Y", Q7A16: "Y" },
      Item5B: { Q5B5: 3 },
      Item2A: { Q2A10: "Y" },
    });

    expect(flags).toEqual([
      "Regulatory History",
      "Dual-Hat Advisors",
      "Insurance Affiliate",
      "Multi-State Adviser",
      "Pooled Vehicle Sponsor",
    ]);
  });

  it("returns empty array when no flags apply", () => {
    expect(deriveRiskFlags({})).toEqual([]);
  });
});

describe("sortRiskFlags", () => {
  it("places Regulatory History first and sorts the rest alphabetically", () => {
    expect(sortRiskFlags(["Insurance Affiliate", "Regulatory History", "Dual-Hat Advisors"])).toEqual(
      ["Regulatory History", "Dual-Hat Advisors", "Insurance Affiliate"],
    );
  });
});

describe("getRiskFlagVariant", () => {
  it("maps flag names to chip variants", () => {
    expect(getRiskFlagVariant("Regulatory History")).toBe("regulatory");
    expect(getRiskFlagVariant("Multi-State Adviser")).toBe("info");
    expect(getRiskFlagVariant("Dual-Hat Advisors")).toBe("amber");
  });
});
