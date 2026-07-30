/**
 * CV-AX-00 — Provenance labels on every answer element.
 * Structural contract; adversarial tests assert never-approve / never-uncited rules.
 */

export const PROVENANCE_LABELS = [
  "source_evidence",
  "firm_policy",
  "regulatory_material",
  "system_inference",
  "reviewer_decision",
] as const;

export type ProvenanceLabel = (typeof PROVENANCE_LABELS)[number];

export type ProvenancedElement = {
  text: string;
  provenance: ProvenanceLabel;
  /** Required when provenance is source_evidence. */
  citationIndex?: number;
};

export type PopulationCompleteness =
  | "complete_population"
  | "ranked_sample";

const APPROVAL_PATTERNS =
  /\b(approved|denied|in violation|violates|legal conclusion|you are compliant|exam ready|exam-ready)\b/i;

/**
 * Label answer spans. Demo slice: treat the whole answer as source_evidence
 * when citations exist; otherwise system_inference is forbidden for compliance claims.
 */
export function labelAnswerElements(args: {
  answer: string;
  citationCount: number;
}): ProvenancedElement[] {
  const text = args.answer.trim();
  if (!text) return [];
  if (args.citationCount > 0) {
    return [
      {
        text,
        provenance: "source_evidence",
        citationIndex: 0,
      },
    ];
  }
  return [{ text, provenance: "system_inference" }];
}

/**
 * Adversarial guard: reject answer payloads that approve/deny, invent records,
 * or assert compliance without citations.
 */
export function assertProvenanceContract(args: {
  elements: ProvenancedElement[];
  citationCount: number;
}): { ok: true } | { ok: false; reason: string } {
  for (const el of args.elements) {
    if (!PROVENANCE_LABELS.includes(el.provenance)) {
      return { ok: false, reason: "unknown_provenance_label" };
    }
    if (APPROVAL_PATTERNS.test(el.text)) {
      return { ok: false, reason: "approval_or_legal_conclusion" };
    }
    if (
      el.provenance === "source_evidence" &&
      (el.citationIndex === undefined || args.citationCount === 0)
    ) {
      return { ok: false, reason: "uncited_source_evidence" };
    }
    if (
      el.provenance === "regulatory_material" &&
      !el.text.toLowerCase().includes("firm policy")
    ) {
      // Regulatory material must not invent external rules in Ask answers.
      return { ok: false, reason: "regulatory_material_not_permitted_in_ask" };
    }
  }

  const hasComplianceAssertion = args.elements.some((el) =>
    /\b(compliant|non-compliant|deficiency|violation)\b/i.test(el.text)
  );
  if (hasComplianceAssertion && args.citationCount === 0) {
    return { ok: false, reason: "uncited_compliance_assertion" };
  }

  return { ok: true };
}

export function populationStatement(
  mode: PopulationCompleteness
): string {
  if (mode === "complete_population") {
    return "Result is a complete population under the stated filters.";
  }
  return "Result is a ranked sample, not a complete population under the stated filters.";
}
