const REGULATORY_HISTORY = "Regulatory History";

export function sortRiskFlags(flags: string[]): string[] {
  const regulatory = flags.filter((flag) => flag === REGULATORY_HISTORY);
  const others = flags.filter((flag) => flag !== REGULATORY_HISTORY).sort();
  return [...regulatory, ...others];
}

export type AdvPart1AForRiskFlags = {
  Item7A?: { Q7A3?: string; Q7A12?: string; Q7A16?: string };
  Item5B?: { Q5B2?: string | number };
  Item2A?: { Q2A10?: string };
} & {
  // Item 11 disciplinary sub-items (Item11, Item11A … Item11H). sec-api key names vary
  // per sub-question, so regulatory history is derived by scanning these rather than
  // enumerating every key. Every Item 11 answer is "Y"/"N".
  [itemKey: `Item11${string}`]: Record<string, unknown> | undefined;
};

// Field mappings verified against SEC Form ADV Part 1A (sec-api.io exposes each
// checkbox/sub-question as Q{item}{n}, mirroring the official form numbering).
export function deriveRiskFlags(part1A: AdvPart1AForRiskFlags): string[] {
  // Item 11 covers the full disciplinary history (11.A/B criminal, 11.C SEC/CFTC,
  // 11.D other regulators, 11.E SRO, 11.H courts). Any "Y" under any Item 11 group is a
  // disclosed event — checking 11.D alone would miss the rest.
  const regulatoryHistory = Object.entries(part1A).some(
    ([key, value]) =>
      key.startsWith("Item11") &&
      typeof value === "object" &&
      value !== null &&
      Object.values(value).some((answer) => answer === "Y"),
  );

  const flags = [
    regulatoryHistory && REGULATORY_HISTORY,
    // Item 7.A.(12): related person is an insurance company or agency (firm-level affiliation).
    part1A.Item7A?.Q7A12 === "Y" && "Insurance Affiliate",
    // Item 5.B.(2): advisory employees who are also registered representatives of a
    // broker-dealer. This is the broker-dealer dual-hat conflict — distinct from the
    // insurance affiliation above (which is Q7A12 / Item 5.B.(5)).
    Number(part1A.Item5B?.Q5B2) > 0 && "Dual-Hat Advisors",
    // Item 7.A.(16): related person is sponsor/GP/managing member of pooled vehicles.
    part1A.Item7A?.Q7A16 === "Y" && "Pooled Vehicle Sponsor",
    // Item 2.A.(10): multi-state adviser required to register in 15+ states (rule 203A-2(d)).
    part1A.Item2A?.Q2A10 === "Y" && "Multi-State Adviser",
    // Item 7.A.(3): related person is a registered municipal advisor.
    part1A.Item7A?.Q7A3 === "Y" && "Municipal Advisor",
  ].filter((flag): flag is string => Boolean(flag));

  return sortRiskFlags(flags);
}

export type RiskFlagVariant = "regulatory" | "amber" | "info";

export function getRiskFlagVariant(flag: string): RiskFlagVariant {
  if (flag === REGULATORY_HISTORY) {
    return "regulatory";
  }
  if (flag === "Multi-State Adviser") {
    return "info";
  }
  return "amber";
}
