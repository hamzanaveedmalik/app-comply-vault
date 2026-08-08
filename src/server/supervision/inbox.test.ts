import { describe, expect, it } from "vitest";
import { inboxTestHelpers } from "./inbox";

describe("CV-SI-006 Priority Inbox classification", () => {
  it("routes unassigned open findings to the Unassigned tab", () => {
    expect(
      inboxTestHelpers.classifyInboxTab(
        { status: "OPEN", assignedToUserId: null, cmTriagedAt: null },
        "cco-1",
      ),
    ).toBe("unassigned");
  });

  it("routes findings assigned to the viewer to Assigned to me", () => {
    expect(
      inboxTestHelpers.classifyInboxTab(
        { status: "OPEN", assignedToUserId: "cco-1", cmTriagedAt: null },
        "cco-1",
      ),
    ).toBe("assigned");
  });

  it("routes assigned findings with triage started to In review", () => {
    expect(
      inboxTestHelpers.classifyInboxTab(
        {
          status: "OPEN",
          assignedToUserId: "cco-1",
          cmTriagedAt: new Date("2026-08-01T00:00:00.000Z"),
        },
        "cco-1",
      ),
    ).toBe("in_review");
  });

  it("routes remediation statuses to Awaiting remediation", () => {
    expect(
      inboxTestHelpers.classifyInboxTab(
        { status: "IN_REMEDIATION", assignedToUserId: "cco-1", cmTriagedAt: null },
        "cco-1",
      ),
    ).toBe("remediation");
    expect(
      inboxTestHelpers.classifyInboxTab(
        {
          status: "PENDING_VERIFICATION",
          assignedToUserId: "cco-1",
          cmTriagedAt: null,
        },
        "cco-1",
      ),
    ).toBe("remediation");
  });

  it("routes closed statuses only to Closed", () => {
    expect(
      inboxTestHelpers.classifyInboxTab(
        { status: "CLOSED", assignedToUserId: null, cmTriagedAt: null },
        "cco-1",
      ),
    ).toBe("closed");
    expect(
      inboxTestHelpers.classifyInboxTab(
        { status: "CLOSED_ACCEPTED_RISK", assignedToUserId: null, cmTriagedAt: null },
        "cco-1",
      ),
    ).toBe("closed");
  });

  it("treats findings assigned to someone else as Escalated", () => {
    expect(
      inboxTestHelpers.classifyInboxTab(
        { status: "OPEN", assignedToUserId: "other-cco", cmTriagedAt: null },
        "cco-1",
      ),
    ).toBe("escalated");
  });
});

describe("CV-SI-006 Priority Inbox eligibility", () => {
  const base = {
    id: "flag-1",
    workspaceId: "ws-1",
    type: "MISSING_DISCLOSURE",
    severity: "CRITICAL" as const,
    status: "OPEN" as const,
    evidence: { excerpt: "synthetic" },
    createdByType: "SYSTEM",
    cmDisposition: "ESCALATED",
    escalationReason: "Rollover documentation gap",
    cmTriagedAt: null,
    escalatedAt: new Date("2026-08-01T00:00:00.000Z"),
    assignedToUserId: null,
    assignedToUser: null,
    reviewDueAt: null,
    materiality: "HIGH" as const,
    policyMappingCode: "ROLLOVER-DOC-v1",
    sourceType: "MEETING" as const,
    meeting: {
      id: "mtg-1",
      clientName: "Helen Navarro",
      supervisoryOutcome: "ESCALATED",
      outcomeConfidence: 0.95,
      advisorCertifiedByUserId: "adv-a",
      advisorCertifiedByUser: { id: "adv-a", name: "Avery Chen" },
      transcript: { segments: [] },
    },
    communication: null,
    resolutionRecord: null,
    workspace: { id: "ws-1", name: "Secure Investment Management" },
  };

  it("includes escalated findings with a primary control and policy mapping", () => {
    expect(inboxTestHelpers.isPriorityInboxEligible(base)).toBe(true);
  });

  it("excludes cleared interactions", () => {
    expect(
      inboxTestHelpers.isPriorityInboxEligible({
        ...base,
        meeting: { ...base.meeting, supervisoryOutcome: "CLEARED" },
      }),
    ).toBe(false);
  });

  it("excludes routine samples unless they were manually escalated", () => {
    expect(
      inboxTestHelpers.isPriorityInboxEligible({
        ...base,
        createdByType: "SYSTEM",
        meeting: { ...base.meeting, supervisoryOutcome: "ROUTINE_SAMPLE" },
      }),
    ).toBe(false);
    expect(
      inboxTestHelpers.isPriorityInboxEligible({
        ...base,
        createdByType: "USER",
        meeting: { ...base.meeting, supervisoryOutcome: "ROUTINE_SAMPLE" },
      }),
    ).toBe(true);
  });

  it("excludes findings without policy mapping so they remain Held", () => {
    expect(
      inboxTestHelpers.isPriorityInboxEligible({
        ...base,
        policyMappingCode: null,
      }),
    ).toBe(false);
  });
});

describe("CV-SI-006 tab counts and filtering", () => {
  it("reconciles tab counts with active findings", () => {
    const counts = inboxTestHelpers.countTabs([
      { tab: "unassigned" },
      { tab: "unassigned" },
      { tab: "assigned" },
      { tab: "remediation" },
      { tab: "closed" },
    ]);
    expect(counts).toEqual({
      unassigned: 2,
      assigned: 1,
      in_review: 0,
      remediation: 1,
      escalated: 4,
      closed: 1,
    });
  });

  it("filters the Escalated tab to every non-closed finding", () => {
    const rows = [
      { id: "1", tab: "unassigned" as const },
      { id: "2", tab: "closed" as const },
      { id: "3", tab: "remediation" as const },
    ];
    expect(inboxTestHelpers.filterFindingsForTab(rows, "escalated").map((r) => r.id)).toEqual([
      "1",
      "3",
    ]);
    expect(inboxTestHelpers.filterFindingsForTab(rows, "closed").map((r) => r.id)).toEqual([
      "2",
    ]);
  });

  it("marks repeat advisers on the same control", () => {
    const keys = inboxTestHelpers.repeatAdviserKeys([
      { adviserId: "adv-a", primaryControl: "MISSING_DISCLOSURE" },
      { adviserId: "adv-a", primaryControl: "MISSING_DISCLOSURE" },
      { adviserId: "adv-b", primaryControl: "MISSING_DISCLOSURE" },
      { adviserId: "adv-a", primaryControl: "FEE_DISPUTE" },
    ]);
    expect(keys.has("adv-a:MISSING_DISCLOSURE")).toBe(true);
    expect(keys.has("adv-b:MISSING_DISCLOSURE")).toBe(false);
    expect(keys.has("adv-a:FEE_DISPUTE")).toBe(false);
  });
});
