import { describe, expect, it } from "vitest";
import {
  DISCLOSURE_CATEGORY_CATALOG,
  iapdFirmSummaryUrl,
  resolveAdvItemRef,
} from "~/lib/disclosure-categories";
import { buildCategorySeedRows } from "~/server/firm-profile/seed-categories";

describe("disclosure category ADV fallback refs", () => {
  it("defines Part 2A Item refs for all 12 categories", () => {
    expect(DISCLOSURE_CATEGORY_CATALOG).toHaveLength(12);
    for (const def of DISCLOSURE_CATEGORY_CATALOG) {
      expect(def.advItemRef).toMatch(/^Part 2A · Item \d+$/);
    }
  });

  it("maps standard fallback refs per PRD table", () => {
    const bySlug = Object.fromEntries(DISCLOSURE_CATEGORY_CATALOG.map((def) => [def.slug, def]));
    expect(bySlug["fees-compensation"]?.advItemRef).toBe("Part 2A · Item 5");
    expect(bySlug["conflicts-of-interest"]?.advItemRef).toBe("Part 2A · Item 10");
    expect(bySlug["disciplinary-history"]?.advItemRef).toBe("Part 2A · Item 9");
    expect(bySlug["referral-comp"]?.advItemRef).toBe("Part 2A · Item 14");
  });

  it("resolveAdvItemRef prefers stored value then catalog fallback", () => {
    expect(resolveAdvItemRef("Part 2A · Item 10, p.14", "conflicts-of-interest")).toBe(
      "Part 2A · Item 10, p.14",
    );
    expect(resolveAdvItemRef(null, "custody")).toBe("Part 2A · Item 15");
    expect(resolveAdvItemRef(null, "unknown-slug")).toBeNull();
  });

  it("builds IAPD firm summary URLs from CRD", () => {
    expect(iapdFirmSummaryUrl("141195")).toBe(
      "https://adviserinfo.sec.gov/firm/summary/141195",
    );
  });
});

describe("buildCategorySeedRows", () => {
  it("seeds advItemRef from catalog for each category", () => {
    const rows = buildCategorySeedRows("profile-1");
    expect(rows).toHaveLength(12);
    for (const row of rows) {
      const def = DISCLOSURE_CATEGORY_CATALOG.find((item) => item.slug === row.slug);
      expect(row.advItemRef).toBe(def?.advItemRef);
    }
  });
});
