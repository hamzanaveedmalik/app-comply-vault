import { describe, expect, it } from "vitest";
import {
  getImplicatedCategorySlugs,
  resolveProfileSkip,
} from "./category-mapping";
import type { DisclosureCategoryStatus } from "../../../generated/prisma";
import { DISCLOSURE_CATEGORY_CATALOG, NEVER_SUPPRESS_SLUGS } from "~/lib/disclosure-categories";

describe("disclosure-categories catalog", () => {
  it("has 12 categories with never-suppress slugs flagged", () => {
    expect(DISCLOSURE_CATEGORY_CATALOG).toHaveLength(12);
    for (const slug of NEVER_SUPPRESS_SLUGS) {
      const def = DISCLOSURE_CATEGORY_CATALOG.find((c) => c.slug === slug);
      expect(def?.neverSuppress).toBe(true);
    }
  });
});

describe("getImplicatedCategorySlugs", () => {
  it("matches fees and conflicts from recommendation text", () => {
    const slugs = getImplicatedCategorySlugs(
      "We recommend increasing equity allocation; our advisory fee schedule applies.",
    );
    expect(slugs).toContain("fees-compensation");
  });

  it("returns empty for unrelated text", () => {
    expect(getImplicatedCategorySlugs("Hello and welcome to the meeting.")).toEqual([]);
  });
});

describe("resolveProfileSkip", () => {
  const map = (entries: Array<[string, DisclosureCategoryStatus]>): Map<string, DisclosureCategoryStatus> =>
    new Map(entries);

  it("returns skip when all implicated are SUPPRESSING", () => {
    expect(
      resolveProfileSkip(
        ["fees-compensation", "no-guarantee"],
        map([
          ["fees-compensation", "SUPPRESSING"],
          ["no-guarantee", "SUPPRESSING"],
        ]),
      ),
    ).toBe("skip");
  });

  it("returns raise when any NEVER_SUPPRESS", () => {
    expect(
      resolveProfileSkip(
        ["fees-compensation", "conflicts-of-interest"],
        map([
          ["fees-compensation", "SUPPRESSING"],
          ["conflicts-of-interest", "NEVER_SUPPRESS"],
        ]),
      ),
    ).toBe("raise-mixed");
  });

  it("returns raise when no profile", () => {
    expect(resolveProfileSkip(["fees-compensation"], null)).toBe("raise");
  });

  it("returns raise-mixed for SUPPRESSING + ACTIVE", () => {
    expect(
      resolveProfileSkip(
        ["fees-compensation", "risk-of-loss"],
        map([
          ["fees-compensation", "SUPPRESSING"],
          ["risk-of-loss", "ACTIVE"],
        ]),
      ),
    ).toBe("raise-mixed");
  });
});
