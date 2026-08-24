/**
 * CV-EA-01/02, CV-AX-00/06, CV-OB-01, CV-PV-01s, CV-XR — unit tests for Release 1 contracts.
 */

import { describe, expect, it } from "vitest";
import {
  complianceItemFromFlag,
  itemAllows,
  sortComplianceItems,
} from "~/server/evidence/compliance-item";
import { resolveEvidenceRef } from "~/server/evidence/evidence-ref";
import {
  assertProvenanceContract,
  labelAnswerElements,
  populationStatement,
} from "~/server/ask/provenance";
import {
  DEMO_COVERAGE_DEFAULTS,
  evaluateHonestMiss,
  buildCoverageManifest,
} from "~/server/ask/coverage";
import {
  heldNameResolution,
  mayAutoLink,
  resolutionFromParticipantMatch,
} from "~/server/identity/resolve";
import {
  assertNoCrossWorkspaceRead,
  listPartnerFirmSnapshots,
} from "~/server/partner/snapshots";
import {
  assertNoExamReadyClaim,
  buildCoverageStatement,
  coverageStatusLabel,
  interpretRequestItem,
} from "~/server/candidate-pack/types";

describe("CV-EA-01 ComplianceItem", () => {
  it("declares capabilities and hides approve when not declared", () => {
    const item = complianceItemFromFlag({
      id: "f1",
      workspaceId: "ws1",
      type: "FEE_DISPUTE",
      severity: "WARN",
      status: "OPEN",
      sourceType: "EMAIL",
      sourceId: "thread1",
      meetingId: null,
      communicationId: "msg1",
      createdAt: new Date("2026-07-01T00:00:00Z"),
      resolvedAt: null,
      resolvedByUserId: null,
      resolutionNote: null,
      cmTriageNote: "Fee concern",
    });
    expect(itemAllows(item, "reviewable")).toBe(true);
    expect(itemAllows(item, "approvable")).toBe(false);
    expect(item.whatIsMissing).toBe("Reviewer decision");
  });

  it("sorts by severity then age", () => {
    const a = complianceItemFromFlag({
      id: "a",
      workspaceId: "ws1",
      type: "FEE_DISPUTE",
      severity: "INFO",
      status: "OPEN",
      sourceType: "MEETING",
      sourceId: "m1",
      meetingId: "m1",
      communicationId: null,
      createdAt: new Date("2026-07-20T00:00:00Z"),
      resolvedAt: null,
      resolvedByUserId: null,
      resolutionNote: null,
      cmTriageNote: null,
    });
    const b = complianceItemFromFlag({
      id: "b",
      workspaceId: "ws1",
      type: "CLIENT_COMPLAINT",
      severity: "CRITICAL",
      status: "OPEN",
      sourceType: "MEETING",
      sourceId: "m2",
      meetingId: "m2",
      communicationId: null,
      createdAt: new Date("2026-07-28T00:00:00Z"),
      resolvedAt: null,
      resolvedByUserId: null,
      resolutionNote: null,
      cmTriageNote: null,
    });
    const sorted = sortComplianceItems([a, b]);
    expect(sorted[0]?.sourceId).toBe("b");
  });
});

describe("CV-EA-02 EvidenceRef", () => {
  it("returns broken state when meeting missing", async () => {
    const result = await resolveEvidenceRef(
      {
        kind: "meeting",
        workspaceId: "ws1",
        sourceId: "missing",
      },
      {
        evidenceItem: {
          findFirst: async () => null,
        },
        meeting: {
          findFirst: async () => null,
        },
      }
    );
    expect(result.status).toBe("broken");
  });

  it("resolves meeting with offset", async () => {
    const result = await resolveEvidenceRef(
      {
        kind: "meeting_offset",
        workspaceId: "ws1",
        sourceId: "m1",
        offsetSec: 12.5,
        sha256: "abc",
      },
      {
        evidenceItem: { findFirst: async () => null },
        meeting: {
          findFirst: async () => ({
            id: "m1",
            clientName: "Test Client",
            meetingDate: new Date("2026-06-01"),
          }),
        },
      }
    );
    expect(result).toEqual({
      status: "ok",
      href: "/meetings/m1#t=12",
      title: "Test Client · 2026-06-01",
      sha256: "abc",
    });
  });
});

describe("CV-AX-00 provenance", () => {
  it("labels cited answers as source_evidence", () => {
    const els = labelAnswerElements({
      answer: "On 2026-05-01 with Margaret, fees were discussed.",
      citationCount: 1,
    });
    expect(els[0]?.provenance).toBe("source_evidence");
    expect(assertProvenanceContract({ elements: els, citationCount: 1 }).ok).toBe(
      true
    );
  });

  it("rejects approval language", () => {
    const els = labelAnswerElements({
      answer: "This recommendation is approved.",
      citationCount: 1,
    });
    const check = assertProvenanceContract({ elements: els, citationCount: 1 });
    expect(check.ok).toBe(false);
  });

  it("rejects uncited compliance assertion", () => {
    const els = labelAnswerElements({
      answer: "The firm is compliant.",
      citationCount: 0,
    });
    const check = assertProvenanceContract({ elements: els, citationCount: 0 });
    expect(check.ok).toBe(false);
  });

  it("states ranked sample vs complete population", () => {
    expect(populationStatement("ranked_sample")).toMatch(/ranked sample/i);
    expect(populationStatement("complete_population")).toMatch(
      /complete population/i
    );
  });
});

describe("CV-AX-06 honest miss", () => {
  const manifest = buildCoverageManifest({
    workspaceId: "ws1",
    emailFrom: new Date("2025-01-01"),
    emailTo: new Date("2026-07-01"),
    emailChunks: 10,
    meetingFrom: new Date("2025-01-01"),
    meetingTo: new Date("2026-07-01"),
    meetingChunks: 5,
    lastIndexedAt: new Date("2026-07-29"),
    gapPeriods: DEMO_COVERAGE_DEFAULTS.gapPeriods,
    unindexedSources: DEMO_COVERAGE_DEFAULTS.unindexedSources,
  });

  it("declines unindexed SMS specifically", () => {
    const miss = evaluateHonestMiss({
      question: "Show me SMS messages about fees",
      manifest,
      matchCount: 3,
      belowThreshold: false,
    });
    expect(miss?.missReason).toBe("unindexed_source");
    expect(miss?.message).toMatch(/SMS/i);
    expect(miss?.message).toMatch(/not indexed/i);
  });

  it("declines out-of-range ISO dates", () => {
    const miss = evaluateHonestMiss({
      question: "What happened on 2023-02-15 regarding fees?",
      manifest,
      matchCount: 2,
      belowThreshold: false,
    });
    expect(miss?.missReason).toBe("out_of_range");
    expect(miss?.message).toMatch(/will not answer from nearest/i);
  });

  it("declines below-threshold without answering from nearest", () => {
    const miss = evaluateHonestMiss({
      question: "Did anyone discuss unicorns?",
      manifest,
      matchCount: 0,
      belowThreshold: true,
    });
    expect(miss?.missReason).toBe("below_threshold");
  });

  it("declines no-evidence topics specifically", () => {
    const miss = evaluateHonestMiss({
      question: "Any evidence of private jet gifts?",
      manifest,
      matchCount: 0,
      belowThreshold: false,
    });
    expect(miss?.missReason).toBe("no_evidence");
    expect(miss?.message).toMatch(/Indexed:/);
  });
});

describe("CV-OB-01 identity resolution", () => {
  it("auto-links exact email at high confidence", () => {
    const r = resolutionFromParticipantMatch({
      address: "client@example.com",
      clientId: "c1",
      userId: null,
      source: "client",
      verified: true,
    });
    expect(mayAutoLink(r)).toBe(true);
    expect(r.heldForConfirmation).toBe(false);
  });

  it("holds name matches — never auto-confirms", () => {
    const r = heldNameResolution({
      name: "Margaret Ellison",
      proposedClientId: "c1",
    });
    expect(r.heldForConfirmation).toBe(true);
    expect(mayAutoLink(r)).toBe(false);
    expect(r.method).toBe("name_exact_held");
  });

  it("routes triage to held state", () => {
    const r = resolutionFromParticipantMatch({
      address: "unknown@example.com",
      clientId: null,
      userId: null,
      source: "triage",
      verified: false,
    });
    expect(r.heldForConfirmation).toBe(true);
  });
});

describe("CV-PV-01s partner snapshots", () => {
  it("returns three firms with named factors and no cross-workspace read", () => {
    const snaps = listPartnerFirmSnapshots();
    expect(snaps).toHaveLength(3);
    for (const s of snaps) {
      expect(s.contributingFactors.length).toBeGreaterThan(0);
      expect(s.coverageCompleteness).toBeGreaterThanOrEqual(0);
    }
    expect(snaps.some((s) => s.drillsIntoDemoWorkspace)).toBe(true);
    expect(assertNoCrossWorkspaceRead()).toEqual({
      crossWorkspaceReadPath: false,
    });
  });
});

describe("CV-XR candidate pack scope", () => {
  it("interprets a request item without generating", () => {
    const scope = interpretRequestItem(
      "Produce all email and meeting records for Margaret Ellison regarding fees from 2025-01-01 to 2026-08-03, excluding SMS and personal messaging channels."
    );
    expect(scope.channels).toContain("EMAIL");
    expect(scope.channels).toContain("MEETING");
    expect(scope.concepts).toContain("fees");
    expect(scope.people.some((p) => /Margaret/i.test(p))).toBe(true);
    expect(scope.exclusions).toEqual(
      expect.arrayContaining(["SMS", "personal messaging"])
    );
  });

  it("interprets a twelve-month period ending in prose dates", () => {
    const scope = interpretRequestItem(
      "Produce all advisory-fee communications and suitability documentation for Marcus Holloway for the twelve-month period ending 13 August 2026, including email and meeting records.",
    );
    expect(scope.dateFrom).toBe("2025-08-13");
    expect(scope.dateTo).toBe("2026-08-13");
    expect(scope.people.some((p) => /Marcus Holloway/i.test(p))).toBe(true);
    expect(scope.concepts).toEqual(
      expect.arrayContaining(["fees", "suitability"]),
    );
    expect(scope.channels).toEqual(
      expect.arrayContaining(["EMAIL", "MEETING"]),
    );
  });

  it("surfaces explicit coverage gap rows with reasons", () => {
    const items = buildCoverageStatement({
      scope: {
        people: ["Marcus Holloway"],
        entities: [],
        dateFrom: "2025-08-13",
        dateTo: "2026-08-13",
        channels: ["EMAIL", "MEETING"],
        concepts: ["fees"],
        exclusions: [],
      },
      meetingCount: 3,
      emailCount: 8,
      gapPeriods: [
        {
          from: "2025-08-13",
          to: "2025-11-22",
          reason:
            "Indexed mailbox and meeting capture begin 23 November 2025 — request covers twelve months",
        },
        {
          from: "2025-08-13",
          to: "2025-11-22",
          reason:
            "Indexed mailbox and meeting capture begin 23 November 2025 — request covers twelve months",
        },
      ],
      unindexedSources: ["SMS"],
    });
    const gaps = items.filter((i) => i.label === "Coverage gap");
    expect(gaps).toHaveLength(1);
    expect(gaps[0]?.detail).toMatch(/2025-08-13 to 2025-11-22/);
    expect(gaps[0]?.detail).toMatch(/Indexed mailbox/);
    expect(items.some((i) => i.status === "data_source_unavailable")).toBe(
      true,
    );
  });

  it("splits request exclusions from unindexed sources", () => {
    const items = buildCoverageStatement({
      scope: {
        people: ["Margaret Ellison"],
        entities: [],
        dateFrom: "2025-01-01",
        dateTo: "2025-06-30",
        channels: ["EMAIL", "MEETING"],
        concepts: ["fees"],
        exclusions: ["SMS", "personal messaging"],
      },
      meetingCount: 2,
      emailCount: 0,
      unindexedSources: ["SMS", "WhatsApp", "Teams chat"],
      searchPopulation: {
        emailsScanned: 40,
        meetingsScanned: 12,
        emailsMatched: 0,
        meetingsMatched: 2,
        sourcesConnected: ["EMAIL", "MEETING"],
      },
    });
    expect(items.some((i) => i.label === "Search population")).toBe(true);
    expect(items.some((i) => i.status === "missing")).toBe(true);
    expect(coverageStatusLabel("missing")).toBe("No matches");
    expect(items.some((i) => i.status === "excluded_by_request")).toBe(true);
    const excluded = items.find((i) => i.status === "excluded_by_request");
    expect(excluded?.detail).toMatch(/SMS/);
    const unavailable = items.find(
      (i) => i.status === "data_source_unavailable"
    );
    expect(unavailable?.unindexedSources ?? []).not.toContain("SMS");
    expect(unavailable?.unindexedSources ?? []).toEqual(
      expect.arrayContaining(["WhatsApp", "Teams chat"])
    );
    for (const i of items) {
      expect(assertNoExamReadyClaim(i.detail)).toBe(true);
      expect(i.detail.toLowerCase()).not.toMatch(/\bmissing\b/);
    }
  });

  it("never allows exam-ready wording", () => {
    expect(assertNoExamReadyClaim("The firm is exam ready")).toBe(false);
    expect(assertNoExamReadyClaim("Candidate pack under confirmed scope")).toBe(
      true
    );
  });

  it("CV-VL-01: coverage labels avoid answerable completeness claims", () => {
    expect(coverageStatusLabel("answerable")).toBe("Matches under scope");
    expect(coverageStatusLabel("partially_answerable")).toBe(
      "Partial matches — gaps remain"
    );
    for (const status of [
      "answerable",
      "partially_answerable",
      "missing",
      "requires_manual_confirmation",
      "data_source_unavailable",
      "excluded_by_request",
    ] as const) {
      const label = coverageStatusLabel(status);
      expect(label.toLowerCase()).not.toMatch(/\banswerable\b/);
      expect(assertNoExamReadyClaim(label)).toBe(true);
    }
  });
});
