import { describe, expect, it } from "vitest";
import {
  emailClassificationLlmSchema,
  emailFlagDedupeKey,
  heuristicEmailPrefilter,
} from "./email-taxonomy";

describe("heuristicEmailPrefilter", () => {
  it("flags guaranteed-return language as a candidate", () => {
    const result = heuristicEmailPrefilter(
      "We can offer guaranteed returns on this portfolio."
    );
    expect(result.candidate).toBe(true);
    expect(result.matchedTypes).toContain("GUARANTEED_RETURN");
  });

  it("returns non-candidate for clean operational mail", () => {
    const result = heuristicEmailPrefilter(
      "Please find attached the quarterly statement for review."
    );
    expect(result.candidate).toBe(false);
    expect(result.matchedTypes).toEqual([]);
  });

  it("detects off-channel references", () => {
    const result = heuristicEmailPrefilter("Can you WhatsApp me later today?");
    expect(result.matchedTypes).toContain("OFF_CHANNEL_REFERENCE");
  });
});

describe("emailClassificationLlmSchema", () => {
  it("parses a clean result", () => {
    const parsed = emailClassificationLlmSchema.parse({
      clean: true,
      signals: [],
    });
    expect(parsed.clean).toBe(true);
    expect(parsed.signals).toEqual([]);
  });

  it("parses a flagged signal", () => {
    const parsed = emailClassificationLlmSchema.parse({
      clean: false,
      signals: [
        {
          category: "GUARANTEED_RETURN",
          severity: "CRITICAL",
          confidence: 0.91,
          excerpt: "guaranteed returns",
          rationale: "Promissory language about returns.",
        },
      ],
    });
    expect(parsed.signals).toHaveLength(1);
    expect(parsed.signals[0]?.category).toBe("GUARANTEED_RETURN");
  });

  it("rejects unknown categories", () => {
    expect(() =>
      emailClassificationLlmSchema.parse({
        clean: false,
        signals: [
          {
            category: "NOT_A_REAL_TYPE",
            severity: "WARN",
            confidence: 0.5,
            excerpt: "x",
            rationale: "y",
          },
        ],
      })
    ).toThrow();
  });
});

describe("emailFlagDedupeKey", () => {
  it("is stable per communication and type", () => {
    expect(emailFlagDedupeKey("msg-1", "GUARANTEED_RETURN")).toBe(
      "email:msg-1:GUARANTEED_RETURN"
    );
  });
});
