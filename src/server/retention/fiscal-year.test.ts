/**
 * CV-TR-04 — Fiscal-year retention expiry tests.
 */

import { describe, expect, it } from "vitest";
import {
  computeExpiresAt,
  describeExpiryForSealToday,
  fiscalYearEndContaining,
  zonedDateParts,
} from "./fiscal-year";

describe("CV-TR-04 fiscal-year retention", () => {
  it("computes 31 Dec 2031 for seal on 14 Mar 2026 (5y, Dec, America/Phoenix)", () => {
    const sealedAt = new Date("2026-03-14T18:00:00.000Z");
    const expiresAt = computeExpiresAt(sealedAt, {
      retentionYears: 5,
      fiscalYearEndMonth: 12,
      fiscalTimezone: "America/Phoenix",
    });
    const parts = zonedDateParts(expiresAt, "America/Phoenix");
    expect(parts).toEqual({ year: 2031, month: 12, day: 31 });
  });

  it("assigns a seal on FYE itself to that fiscal year", () => {
    // 31 Dec 2026 12:00 Phoenix = 19:00 UTC
    const sealedAt = new Date("2026-12-31T19:00:00.000Z");
    const fye = fiscalYearEndContaining(sealedAt, 12, "America/Phoenix");
    expect(fye).toEqual({ year: 2026, month: 12, day: 31 });

    const expiresAt = computeExpiresAt(sealedAt, {
      retentionYears: 5,
      fiscalYearEndMonth: 12,
      fiscalTimezone: "America/Phoenix",
    });
    expect(zonedDateParts(expiresAt, "America/Phoenix")).toEqual({
      year: 2031,
      month: 12,
      day: 31,
    });
  });

  it("handles non-December fiscal year end (June)", () => {
    // Seal 15 Jul 2026 → after June FYE → containing FYE is 30 Jun 2027
    const sealedAt = new Date("2026-07-15T17:00:00.000Z");
    const fye = fiscalYearEndContaining(sealedAt, 6, "America/New_York");
    expect(fye).toEqual({ year: 2027, month: 6, day: 30 });

    const expiresAt = computeExpiresAt(sealedAt, {
      retentionYears: 5,
      fiscalYearEndMonth: 6,
      fiscalTimezone: "America/New_York",
    });
    expect(zonedDateParts(expiresAt, "America/New_York")).toEqual({
      year: 2032,
      month: 6,
      day: 30,
    });
  });

  it("handles seal before June FYE in same calendar year", () => {
    const sealedAt = new Date("2026-03-14T17:00:00.000Z");
    const fye = fiscalYearEndContaining(sealedAt, 6, "America/New_York");
    expect(fye).toEqual({ year: 2026, month: 6, day: 30 });
  });

  it("describes expiry in plain language", () => {
    const text = describeExpiryForSealToday(new Date("2026-03-14T18:00:00.000Z"), {
      retentionYears: 5,
      fiscalYearEndMonth: 12,
      fiscalTimezone: "America/Phoenix",
    });
    expect(text).toContain("December 31, 2031");
    expect(text).toContain("America/Phoenix");
  });
});
