import { describe, expect, it } from "vitest";
import { ASK_DEMO_EVAL_SET } from "./eval-set";

describe("CV-AX-05a ask demo evaluation set", () => {
  it("has 10 topics with 3 phrasings each", () => {
    expect(ASK_DEMO_EVAL_SET).toHaveLength(10);
    for (const c of ASK_DEMO_EVAL_SET) {
      expect(c.phrasings).toHaveLength(3);
      expect(c.topicId.length).toBeGreaterThan(0);
    }
  });

  it("includes honest-miss rehearsals for unindexed and out-of-range", () => {
    const miss = ASK_DEMO_EVAL_SET.filter((c) => c.expectKind === "honest-miss");
    expect(miss.length).toBeGreaterThanOrEqual(3);
    expect(miss.some((c) => /sms/i.test(c.topicId))).toBe(true);
    expect(miss.some((c) => /out-of-range/i.test(c.topicId))).toBe(true);
  });
});
