import { describe, expect, it } from "vitest";
import { extractKeywords } from "./keywords";

describe("extractKeywords", () => {
  it("drops stopwords and keeps meaningful tokens", () => {
    const kw = extractKeywords("Did Rob discuss fee changes at the May review?");
    expect(kw).toEqual(["rob", "discuss", "fee", "changes", "may", "review"]);
  });

  it("lowercases and deduplicates", () => {
    const kw = extractKeywords("Fee fee FEE about fees");
    expect(kw).toEqual(["fee", "fees"]);
  });

  it("returns empty array for stopword-only input", () => {
    const kw = extractKeywords("did the about a the");
    expect(kw).toEqual([]);
  });

  it("caps to 10 keywords", () => {
    const kw = extractKeywords(
      "alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu nu"
    );
    expect(kw).toHaveLength(10);
  });

  it("handles hyphenated and apostrophe tokens", () => {
    const kw = extractKeywords("Discuss soft-dollar arrangements and don't forget Rob");
    expect(kw).toContain("soft-dollar");
    expect(kw).toContain("rob");
  });
});
