const REGULATORY_HISTORY = "Regulatory History";

export function sortRiskFlags(flags: string[]): string[] {
  const regulatory = flags.filter((flag) => flag === REGULATORY_HISTORY);
  const others = flags.filter((flag) => flag !== REGULATORY_HISTORY).sort();
  return [...regulatory, ...others];
}

export type AdvPart1AForRiskFlags = {
  Item11D?: { Q11D2?: string };
  Item7A?: { Q7A12?: string; Q7A16?: string };
  Item5B?: { Q5B5?: string | number };
  Item2A?: { Q2A10?: string };
};

export function deriveRiskFlags(part1A: AdvPart1AForRiskFlags): string[] {
  const flags = [
    part1A.Item11D?.Q11D2 === "Y" && REGULATORY_HISTORY,
    part1A.Item7A?.Q7A12 === "Y" && "Insurance Affiliate",
    Number(part1A.Item5B?.Q5B5) > 0 && "Dual-Hat Advisors",
    part1A.Item7A?.Q7A16 === "Y" && "Pooled Vehicle Sponsor",
    part1A.Item2A?.Q2A10 === "Y" && "Multi-State Adviser",
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
