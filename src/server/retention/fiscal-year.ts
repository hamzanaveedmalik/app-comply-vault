/**
 * CV-TR-04 — Fiscal-year anchored retention expiry (Rule 204-2 style).
 *
 * Expiry is the last instant of the fiscal year end date, N years after the
 * fiscal year that contains the seal date — computed as date-only calendar
 * arithmetic in the workspace fiscal timezone, then stored as UTC.
 */

export type RetentionPolicyInput = {
  retentionYears: number;
  fiscalYearEndMonth: number;
  fiscalTimezone: string;
};

/**
 * Parts of a calendar date in a specific IANA timezone.
 */
export function zonedDateParts(
  instant: Date,
  timeZone: string,
): { year: number; month: number; day: number } {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  });
  const parts = fmt.formatToParts(instant);
  const year = Number(parts.find((p) => p.type === "year")?.value);
  const month = Number(parts.find((p) => p.type === "month")?.value);
  const day = Number(parts.find((p) => p.type === "day")?.value);
  if (!year || !month || !day) {
    throw new Error("Failed to resolve zoned calendar date");
  }
  return { year, month, day };
}

/**
 * Convert a calendar Y-M-D at 23:59:59.999 in `timeZone` to a UTC Date.
 * Uses iterative offset resolution (handles DST).
 */
export function endOfZonedCalendarDay(
  year: number,
  month: number,
  day: number,
  timeZone: string,
): Date {
  // Noon UTC guess on that calendar day, then adjust by zone offset.
  let utc = Date.UTC(year, month - 1, day, 12, 0, 0, 0);
  for (let i = 0; i < 3; i++) {
    const parts = zonedDateParts(new Date(utc), timeZone);
    const asUtcNoon = Date.UTC(parts.year, parts.month - 1, parts.day, 12, 0, 0, 0);
    const offsetMs = asUtcNoon - utc;
    // Want local 23:59:59.999 on year-month-day
    const targetLocalAsIfUtc = Date.UTC(year, month - 1, day, 23, 59, 59, 999);
    utc = targetLocalAsIfUtc - offsetMs;
  }
  // Verify landing day matches; if not, nudge
  const check = zonedDateParts(new Date(utc), timeZone);
  if (check.year !== year || check.month !== month || check.day !== day) {
    // Fallback: binary-search the UTC ms that maps to end of that local day
    const startGuess = Date.UTC(year, month - 1, day, 0, 0, 0, 0) - 36 * 3600 * 1000;
    const endGuess = Date.UTC(year, month - 1, day, 0, 0, 0, 0) + 48 * 3600 * 1000;
    let lo = startGuess;
    let hi = endGuess;
    let best = utc;
    while (lo <= hi) {
      const mid = Math.floor((lo + hi) / 2);
      const p = zonedDateParts(new Date(mid), timeZone);
      const cmp =
        p.year !== year
          ? p.year - year
          : p.month !== month
            ? p.month - month
            : p.day - day;
      if (cmp < 0) lo = mid + 1;
      else if (cmp > 0) hi = mid - 1;
      else {
        best = mid;
        lo = mid + 1; // push toward end of day
      }
    }
    return new Date(best);
  }
  return new Date(utc);
}

/**
 * Fiscal year end calendar date that contains `sealedAt`.
 * A seal on the FYE date itself belongs to that fiscal year (not the next).
 */
export function fiscalYearEndContaining(
  sealedAt: Date,
  fiscalYearEndMonth: number,
  fiscalTimezone: string,
): { year: number; month: number; day: number } {
  if (fiscalYearEndMonth < 1 || fiscalYearEndMonth > 12) {
    throw new Error("fiscalYearEndMonth must be 1-12");
  }
  const { year, month, day } = zonedDateParts(sealedAt, fiscalTimezone);
  const fyeDay = lastCalendarDayOfMonth(year, fiscalYearEndMonth);

  // Compare (year, month, day) to (year, fyeMonth, fyeDay) on the seal's calendar year first.
  const sealBeforeOrOnFyeThisYear =
    month < fiscalYearEndMonth ||
    (month === fiscalYearEndMonth && day <= fyeDay);

  if (sealBeforeOrOnFyeThisYear) {
    return { year, month: fiscalYearEndMonth, day: fyeDay };
  }
  // After FYE in this calendar year → fiscal year ending next calendar year
  const nextYear = year + 1;
  return {
    year: nextYear,
    month: fiscalYearEndMonth,
    day: lastCalendarDayOfMonth(nextYear, fiscalYearEndMonth),
  };
}

function lastCalendarDayOfMonth(year: number, month: number): number {
  // Day 0 of next month = last day of this month
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * Compute seal expiry: FYE of (containing fiscal year + retentionYears), end of that day in fiscal TZ.
 *
 * Example: sealed 14 Mar 2026, FYE December, 5 years, America/Phoenix
 * → containing FYE 31 Dec 2026 → expiry 31 Dec 2031 23:59:59.999 America/Phoenix (as UTC).
 */
export function computeExpiresAt(
  sealedAt: Date,
  policy: RetentionPolicyInput,
): Date {
  if (policy.retentionYears < 5) {
    throw new Error("retentionYears must be at least 5");
  }
  const containing = fiscalYearEndContaining(
    sealedAt,
    policy.fiscalYearEndMonth,
    policy.fiscalTimezone,
  );
  const expiryYear = containing.year + policy.retentionYears;
  const expiryDay = lastCalendarDayOfMonth(expiryYear, policy.fiscalYearEndMonth);
  return endOfZonedCalendarDay(
    expiryYear,
    policy.fiscalYearEndMonth,
    expiryDay,
    policy.fiscalTimezone,
  );
}

/**
 * Plain-language preview for settings confirmation dialog.
 */
export function describeExpiryForSealToday(
  sealedAt: Date,
  policy: RetentionPolicyInput,
): string {
  const expiresAt = computeExpiresAt(sealedAt, policy);
  const parts = zonedDateParts(expiresAt, policy.fiscalTimezone);
  const monthName = new Date(Date.UTC(2000, parts.month - 1, 1)).toLocaleString("en-US", {
    month: "long",
    timeZone: "UTC",
  });
  return `A record sealed today would be retained until ${monthName} ${parts.day}, ${parts.year} (${policy.fiscalTimezone}).`;
}
