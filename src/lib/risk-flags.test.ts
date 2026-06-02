import { describe, expect, it } from "vitest";
import { deriveRiskFlags, getRiskFlagVariant, sortRiskFlags } from "~/lib/risk-flags";

describe("deriveRiskFlags", () => {
  it("derives all six flag types from ADV Part 1A fields", () => {
    const flags = deriveRiskFlags({
      Item11D: { Q11D2: "Y" },
      Item7A: { Q7A3: "Y", Q7A12: "Y", Q7A16: "Y" },
      Item5B: { Q5B2: 3 },
      Item2A: { Q2A10: "Y" },
    });

    expect(flags).toEqual([
      "Regulatory History",
      "Dual-Hat Advisors",
      "Insurance Affiliate",
      "Multi-State Adviser",
      "Municipal Advisor",
      "Pooled Vehicle Sponsor",
    ]);
  });

  it("flags Municipal Advisor from Item 7.A.(3) only", () => {
    expect(deriveRiskFlags({ Item7A: { Q7A3: "Y" } })).toEqual(["Municipal Advisor"]);
  });

  it("does NOT confuse Municipal Advisor (Q7A3) with Insurance Affiliate (Q7A12)", () => {
    expect(deriveRiskFlags({ Item7A: { Q7A12: "Y" } })).toEqual(["Insurance Affiliate"]);
    expect(deriveRiskFlags({ Item7A: { Q7A3: "Y" } })).not.toContain("Insurance Affiliate");
  });

  it("derives Regulatory History from any Item 11 group, not just 11.D", () => {
    // 11.A criminal, 11.C SEC/CFTC, 11.E SRO, 11.H courts must all count.
    expect(deriveRiskFlags({ Item11A: { Q11A1: "Y" } })).toEqual(["Regulatory History"]);
    expect(deriveRiskFlags({ Item11C: { Q11C1: "Y" } })).toEqual(["Regulatory History"]);
    expect(deriveRiskFlags({ Item11E: { Q11E1: "Y" } })).toEqual(["Regulatory History"]);
    expect(deriveRiskFlags({ Item11H: { Q11H1A: "Y" } })).toEqual(["Regulatory History"]);
  });

  it("does NOT flag Regulatory History when every Item 11 answer is 'N'", () => {
    const flags = deriveRiskFlags({
      Item11A: { Q11A1: "N", Q11A2: "N" },
      Item11D: { Q11D1: "N", Q11D2: "N" },
    });
    expect(flags).not.toContain("Regulatory History");
  });

  it("flags Dual-Hat from broker-dealer registered reps (Item 5.B.(2))", () => {
    expect(deriveRiskFlags({ Item5B: { Q5B2: 1 } })).toEqual(["Dual-Hat Advisors"]);
  });

  it("does NOT flag Dual-Hat for insurance-licensed staff alone (Item 7.A.(12))", () => {
    // A firm whose only affiliation is insurance should surface Insurance Affiliate,
    // not Dual-Hat. Dual-Hat is the distinct broker-dealer conflict (Item 5.B.(2)).
    const flags = deriveRiskFlags({ Item7A: { Q7A12: "Y" }, Item5B: { Q5B2: 0 } });
    expect(flags).toEqual(["Insurance Affiliate"]);
    expect(flags).not.toContain("Dual-Hat Advisors");
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
