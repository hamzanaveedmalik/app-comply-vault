import { describe, expect, it } from "vitest";
import {
  defaultSupervisionWindow,
  parseSupervisionFilters,
  serializeSupervisionFilters,
  supervisionHref,
  toSummaryQuery,
} from "./filters";
import { portfolioTestHelpers } from "./portfolio";

const NOW = new Date("2026-08-08T12:00:00.000Z");

describe("CV-SI-005 supervision filters", () => {
  it("defaults empty query to a 30-day window without extra params", () => {
    const filters = parseSupervisionFilters({}, NOW);
    expect(filters).toEqual({
      dateFrom: "2026-07-10",
      dateTo: "2026-08-08",
      firmId: undefined,
      adviserId: undefined,
      channel: undefined,
      control: undefined,
      outcome: undefined,
      severity: undefined,
      findingStatus: undefined,
      inboxTab: undefined,
    });
    expect(serializeSupervisionFilters(filters, NOW).toString()).toBe("");
    expect(defaultSupervisionWindow(NOW)).toEqual({
      dateFrom: "2026-07-10",
      dateTo: "2026-08-08",
    });
  });

  it("round-trips non-default filters into the URL", () => {
    const filters = parseSupervisionFilters(
      {
        from: "2026-07-01",
        to: "2026-07-15",
        firm: "si-as-ws-secure",
        adviser: "si-as-user-adv-a",
        channel: "MEETING",
        control: "MISSING_DISCLOSURE",
        outcome: "ESCALATED",
        severity: "WARN",
        status: "IN_REMEDIATION",
      },
      NOW,
    );

    expect(filters.firmId).toBe("si-as-ws-secure");
    expect(filters.adviserId).toBe("si-as-user-adv-a");
    expect(filters.channel).toBe("MEETING");
    expect(filters.control).toBe("MISSING_DISCLOSURE");
    expect(filters.outcome).toBe("ESCALATED");
    expect(filters.severity).toBe("WARN");
    expect(filters.findingStatus).toBe("IN_REMEDIATION");

    const href = supervisionHref("/supervision", filters, undefined, NOW);
    expect(href).toContain("/supervision?");
    expect(href).toContain("from=2026-07-01");
    expect(href).toContain("to=2026-07-15");
    expect(href).toContain("firm=si-as-ws-secure");
    expect(href).toContain("adviser=si-as-user-adv-a");
    expect(href).toContain("channel=MEETING");
    expect(href).toContain("control=MISSING_DISCLOSURE");
    expect(href).toContain("outcome=ESCALATED");
    expect(href).toContain("severity=WARN");
    expect(href).toContain("status=IN_REMEDIATION");

    const parsedAgain = parseSupervisionFilters(
      Object.fromEntries(new URL(`https://app.example${href}`).searchParams.entries()),
      NOW,
    );
    expect(parsedAgain).toEqual(filters);
  });

  it("drops unknown enum values instead of failing the page", () => {
    const filters = parseSupervisionFilters(
      {
        channel: "SMS",
        outcome: "VIOLATION",
        severity: "HIGH",
        status: "ARCHIVED",
        control: "NOT_A_CONTROL",
      },
      NOW,
    );
    expect(filters.channel).toBeUndefined();
    expect(filters.outcome).toBeUndefined();
    expect(filters.severity).toBeUndefined();
    expect(filters.findingStatus).toBeUndefined();
    expect(filters.control).toBeUndefined();
  });

  it("accepts legacy firmId/adviserId query keys", () => {
    const filters = parseSupervisionFilters(
      { firmId: "si-as-ws-northstar", adviserId: "si-as-user-adv-b" },
      NOW,
    );
    expect(filters.firmId).toBe("si-as-ws-northstar");
    expect(filters.adviserId).toBe("si-as-user-adv-b");
  });

  it("swaps inverted date ranges", () => {
    const filters = parseSupervisionFilters(
      { from: "2026-08-08", to: "2026-07-10" },
      NOW,
    );
    expect(filters.dateFrom).toBe("2026-07-10");
    expect(filters.dateTo).toBe("2026-08-08");
  });

  it("maps filters to inclusive UTC bounds for queries", () => {
    const query = toSummaryQuery(
      parseSupervisionFilters({ from: "2026-07-10", to: "2026-08-08" }, NOW),
    );
    expect(query.dateFrom.toISOString()).toBe("2026-07-10T00:00:00.000Z");
    expect(query.dateTo.toISOString()).toBe("2026-08-08T23:59:59.999Z");
  });

  it("preserves inbox extras while keeping filter state", () => {
    const filters = parseSupervisionFilters(
      { firm: "si-as-ws-secure", control: "MISSING_DISCLOSURE" },
      NOW,
    );
    const href = supervisionHref(
      "/priority-inbox",
      filters,
      { finding: "si-as-flag-rollover-001" },
      NOW,
    );
    expect(href).toContain("/priority-inbox?");
    expect(href).toContain("firm=si-as-ws-secure");
    expect(href).toContain("control=MISSING_DISCLOSURE");
    expect(href).toContain("finding=si-as-flag-rollover-001");
  });

  it("round-trips inbox tab in the URL except the default Unassigned tab", () => {
    const assigned = parseSupervisionFilters({ tab: "assigned" }, NOW);
    expect(assigned.inboxTab).toBe("assigned");
    expect(serializeSupervisionFilters(assigned, NOW).get("tab")).toBe("assigned");

    const unassigned = parseSupervisionFilters({ tab: "unassigned" }, NOW);
    expect(unassigned.inboxTab).toBe("unassigned");
    expect(serializeSupervisionFilters(unassigned, NOW).get("tab")).toBeNull();
  });

  it("cannot filter into unauthorised firms", () => {
    const authorised = ["si-as-ws-secure", "si-as-ws-desert-ridge"];
    expect(
      portfolioTestHelpers.restrictToAuthorisedFirms(authorised, "si-as-ws-secure"),
    ).toEqual(["si-as-ws-secure"]);
    expect(
      portfolioTestHelpers.restrictToAuthorisedFirms(authorised, "si-as-ws-northstar"),
    ).toEqual([]);
    expect(portfolioTestHelpers.restrictToAuthorisedFirms(authorised)).toEqual(
      authorised,
    );
  });
});
