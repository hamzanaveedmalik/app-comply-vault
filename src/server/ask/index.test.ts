/**
 * Ask ComplyVault orchestrator tests (CV-FEAT-014).
 *
 * Tests are deliberately written against an in-memory stub of the Prisma
 * client so the compliance guarantees from PRD §6 can be pinned in CI
 * without standing up a database:
 *
 *   - §6.1 workspace isolation (cross-workspace red-team)
 *   - §6.2 regulatory-citation post-filter
 *   - §6.3 soft-delete / status filtering
 *   - §6.4 PII handling in audit metadata (no raw question, no client name)
 *   - §6.6 audit-log emission on every code path
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { askComplyVault, hashQuestion } from "./index";
import type { RetrievalCandidate } from "./types";
import type { AskCompletionInput } from "./provider";

type StubMeetingRow = RetrievalCandidate & {
  workspaceId: string;
  status: string;
  deletedAt: Date | null;
};

type AuditCall = {
  workspaceId: string;
  userId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  metadata: Record<string, unknown>;
};

function buildStubPrisma(meetings: StubMeetingRow[]) {
  const auditCalls: AuditCall[] = [];
  const findManyCalls: Array<{ where: Record<string, unknown> }> = [];

  const prisma = {
    meeting: {
      findMany: vi.fn(async (args: {
        where: Record<string, unknown>;
        select: Record<string, true>;
        take: number;
        orderBy: Array<Record<string, "asc" | "desc">>;
      }) => {
        findManyCalls.push({ where: args.where });
        const where = args.where;
        return meetings
          .filter((m) => m.workspaceId === where.workspaceId)
          .filter((m) => {
            const status = where.status as { in: string[] } | undefined;
            if (!status) return true;
            return status.in.includes(m.status);
          })
          .filter((m) => {
            const idFilter = where.id as string | undefined;
            if (!idFilter) return true;
            return m.id === idFilter;
          })
          .filter((m) => {
            const dateFilter = where.meetingDate as { gte: Date } | undefined;
            if (!dateFilter) return true;
            return m.meetingDate.getTime() >= dateFilter.gte.getTime();
          })
          .filter((m) => {
            const or = where.OR as
              | Array<{ searchableText: { contains: string } }>
              | undefined;
            if (!or || or.length === 0) return true;
            const haystack = (m.searchableText ?? "").toLowerCase();
            return or.some((clause) =>
              haystack.includes(clause.searchableText.contains.toLowerCase())
            );
          })
          .slice(0, args.take)
          .sort((a, b) => b.meetingDate.getTime() - a.meetingDate.getTime())
          .map(
            ({ workspaceId: _ws, status: _s, deletedAt: _d, ...rest }) => rest
          );
      }),
    },
    auditEvent: {
      create: vi.fn(async (args: { data: AuditCall }) => {
        auditCalls.push(args.data);
        return { id: `audit-${auditCalls.length}` };
      }),
    },
  };

  return { prisma, auditCalls, findManyCalls };
}

function meeting(overrides: Partial<StubMeetingRow>): StubMeetingRow {
  return {
    id: "m1",
    sourceType: "MEETING",
    workspaceId: "wA",
    status: "FINALIZED",
    deletedAt: null,
    clientName: "Rob Cabrera",
    meetingDate: new Date("2026-05-14T15:00:00Z"),
    meetingType: "Quarterly Review",
    transcript: {
      segments: [
        {
          startTime: 42.1,
          endTime: 50.5,
          speaker: "Advisor",
          text: "We're stepping you up to the 1.25 tier effective June 1.",
        },
        {
          startTime: 180.4,
          endTime: 188.0,
          speaker: "Client",
          text: "Confirmed comfortable with the new pricing.",
        },
        {
          startTime: 300.0,
          endTime: 305.0,
          speaker: "Advisor",
          text: "Thanks for your time today.",
        },
      ],
    },
    extraction: {
      topics: [{ title: "Fee schedule update", description: "Fee tier moved from 1.00 to 1.25" }],
      recommendations: [],
      disclosures: [],
      decisions: [
        {
          text: "Client agreed to the new 1.25 fee tier effective June 1.",
          startTime: 180.4,
          endTime: 188.0,
        },
      ],
      followUps: [],
    },
    searchableText:
      "we're stepping you up to the 1.25 tier effective june 1 confirmed comfortable with the new pricing fee schedule update fee tier moved from 1.00 to 1.25 client agreed to the new 1.25 fee tier",
    ...overrides,
  };
}

const QUESTION_FEE = "Did Rob discuss fee changes at the May review?";

describe("askComplyVault — happy path", () => {
  it("returns an answer with structural citations from retrieved meetings", async () => {
    const { prisma, auditCalls } = buildStubPrisma([meeting({})]);
    const completion = vi.fn(async () =>
      "On May 14 with Rob Cabrera, fees moved to the 1.25 tier and the client confirmed comfort."
    );

    const outcome = await askComplyVault(
      {
        question: QUESTION_FEE,
        workspaceId: "wA",
        userId: "user-1",
      },
      { prisma, completion, model: "gpt-4o-mini", emailIntelligenceEnabled: false }
    );

    expect(outcome.kind).toBe("answer");
    if (outcome.kind !== "answer") throw new Error("unreachable");
    expect(outcome.answer).toContain("Rob Cabrera");
    expect(outcome.citations).toHaveLength(1);
    expect(outcome.citations[0]?.meetingId).toBe("m1");
    expect(outcome.citations[0]?.clientName).toBe("Rob Cabrera");
    expect(outcome.citations[0]?.snippet).toContain("1.25");
    expect(outcome.retrieval.mode).toBe("keyword");
    expect(outcome.retrieval.candidatesUsed).toBe(1);

    expect(completion).toHaveBeenCalledOnce();
    const firstCallArgs = completion.mock.calls.at(0) as
      | [AskCompletionInput]
      | undefined;
    const call = firstCallArgs?.[0];
    expect(call?.userMessage).toContain("<evidence>");
    expect(call?.userMessage).toContain(QUESTION_FEE);

    expect(auditCalls).toHaveLength(1);
    expect(auditCalls[0]?.action).toBe("AI_QUERY");
    expect(auditCalls[0]?.resourceType).toBe("workspace");
    expect(auditCalls[0]?.metadata.retrievedMeetingIds).toEqual(["m1"]);
  });

  it("citations are structural — extracted from evidence, not from prose", async () => {
    const { prisma } = buildStubPrisma([meeting({})]);
    // Model hallucinates an extra client name. The citation list must
    // still only include the meeting we shipped as evidence.
    const completion = vi.fn(
      async () =>
        "On May 14 with Rob Cabrera, fees moved to the 1.25 tier. Also Sarah Johnson on April 2 mentioned similar pricing."
    );

    const outcome = await askComplyVault(
      { question: QUESTION_FEE, workspaceId: "wA", userId: "user-1" },
      { prisma, completion, model: "gpt-4o-mini", emailIntelligenceEnabled: false }
    );

    expect(outcome.kind).toBe("answer");
    if (outcome.kind !== "answer") throw new Error("unreachable");
    const cited = outcome.citations.map((c) => c.clientName);
    expect(cited).toEqual(["Rob Cabrera"]);
    expect(cited).not.toContain("Sarah Johnson");
  });
it("coerces LLM empty-refusal when retrieval returned evidence", async () => {
    const { prisma } = buildStubPrisma([meeting({})]);
    const completion = vi.fn(
      async () => "No matching correspondence found in your workspace."
    );

    const outcome = await askComplyVault(
      { question: QUESTION_FEE, workspaceId: "wA", userId: "user-1" },
      { prisma, completion, model: "gpt-4o-mini", emailIntelligenceEnabled: false }
    );

    expect(outcome.kind).toBe("answer");
    if (outcome.kind !== "answer") throw new Error("unreachable");
    expect(outcome.answer).not.toMatch(/no matching correspondence/i);
    expect(outcome.citations).toHaveLength(1);
    expect(outcome.citations[0]?.meetingId).toBe("m1");
  });
});

describe("askComplyVault — no evidence / honest miss (CV-AX-06)", () => {
  it("short-circuits without calling the LLM when retrieval is empty", async () => {
    const { prisma, auditCalls } = buildStubPrisma([
      meeting({ searchableText: "completely unrelated meeting about insurance" }),
    ]);
    const completion = vi.fn(async () => "should not be called");

    const outcome = await askComplyVault(
      {
        question: "Did Sarah disclose the soft-dollar arrangement at the May review?",
        workspaceId: "wA",
        userId: "user-1",
      },
      { prisma, completion, model: "gpt-4o-mini", emailIntelligenceEnabled: false }
    );

    expect(["no-evidence", "honest-miss"]).toContain(outcome.kind);
    expect(completion).not.toHaveBeenCalled();
    expect(auditCalls).toHaveLength(1);
    expect(auditCalls[0]?.metadata.retrievedMeetingIds).toEqual([]);
  });

  it("reports empty workspace without calling the LLM", async () => {
    const { prisma } = buildStubPrisma([]);
    const completion = vi.fn(async () => "");

    const outcome = await askComplyVault(
      { question: QUESTION_FEE, workspaceId: "wA", userId: "user-1" },
      { prisma, completion, model: "gpt-4o-mini", emailIntelligenceEnabled: false }
    );

    expect(["no-evidence", "honest-miss"]).toContain(outcome.kind);
    expect(completion).not.toHaveBeenCalled();
  });

  it("returns a specific honest miss for unindexed SMS", async () => {
    const { prisma } = buildStubPrisma([meeting({})]);
    const completion = vi.fn(async () => "should not be called");

    const outcome = await askComplyVault(
      {
        question: "Show me SMS messages about fee changes",
        workspaceId: "wA",
        userId: "user-1",
      },
      { prisma, completion, model: "gpt-4o-mini", emailIntelligenceEnabled: false }
    );

    expect(outcome.kind).toBe("honest-miss");
    if (outcome.kind !== "honest-miss") throw new Error("unreachable");
    expect(outcome.missReason).toBe("unindexed_source");
    expect(outcome.message).toMatch(/SMS/i);
    expect(completion).not.toHaveBeenCalled();
  });
});

describe("askComplyVault — workspace isolation (PRD §6.1)", () => {
  it("RED TEAM: a question in workspace A cannot retrieve workspace B meetings", async () => {
    const wbOnly = meeting({
      id: "mb-1",
      workspaceId: "wB",
      clientName: "WORKSPACE_B_CLIENT",
      searchableText: "rob discussed fee changes at the may review in workspace b",
    });
    const { prisma, auditCalls, findManyCalls } = buildStubPrisma([wbOnly]);
    const completion = vi.fn(async () => "should not be called");

    const outcome = await askComplyVault(
      { question: QUESTION_FEE, workspaceId: "wA", userId: "user-a" },
      { prisma, completion, model: "gpt-4o-mini", emailIntelligenceEnabled: false }
    );

    expect(["no-evidence", "honest-miss"]).toContain(outcome.kind);
    expect(completion).not.toHaveBeenCalled();
    // Where clause must include the workspaceId from the caller.
    expect(findManyCalls[0]?.where.workspaceId).toBe("wA");
    // Audit metadata MUST NOT contain workspace B's meeting id or
    // client name.
    const audit = auditCalls[0]?.metadata as Record<string, unknown>;
    const serialised = JSON.stringify(audit);
    expect(serialised).not.toContain("mb-1");
    expect(serialised).not.toContain("WORKSPACE_B_CLIENT");
  });

  it("still answers when BOTH workspaces have matching meetings but only the caller's is returned", async () => {
    const wA = meeting({ id: "m-a", workspaceId: "wA", clientName: "A Client" });
    const wB = meeting({
      id: "m-b",
      workspaceId: "wB",
      clientName: "B Client (LEAK)",
    });
    const { prisma } = buildStubPrisma([wA, wB]);
    const completion = vi.fn(async () =>
      "On May 14 with A Client, fees moved to the 1.25 tier."
    );

    const outcome = await askComplyVault(
      { question: QUESTION_FEE, workspaceId: "wA", userId: "user-a" },
      { prisma, completion, model: "gpt-4o-mini", emailIntelligenceEnabled: false }
    );

    expect(outcome.kind).toBe("answer");
    if (outcome.kind !== "answer") throw new Error("unreachable");
    const meetingIds = outcome.citations.map((c) => c.meetingId);
    expect(meetingIds).toEqual(["m-a"]);
    expect(meetingIds).not.toContain("m-b");

    const firstCallArgs = completion.mock.calls.at(0) as
      | [AskCompletionInput]
      | undefined;
    const userMessage = firstCallArgs?.[0]?.userMessage ?? "";
    expect(userMessage).not.toContain("m-b");
    expect(userMessage).not.toContain("B Client (LEAK)");
  });
});

describe("askComplyVault — status filtering (PRD §6.3)", () => {
  it("excludes meetings whose status is not DRAFT_READY or FINALIZED", async () => {
    const inFlight = meeting({ id: "m-in-flight", status: "PROCESSING" });
    const { prisma, findManyCalls } = buildStubPrisma([inFlight]);
    const completion = vi.fn(async () => "should not be called");

    const outcome = await askComplyVault(
      { question: QUESTION_FEE, workspaceId: "wA", userId: "user-1" },
      { prisma, completion, model: "gpt-4o-mini", emailIntelligenceEnabled: false }
    );

    expect(["no-evidence", "honest-miss"]).toContain(outcome.kind);
    expect(completion).not.toHaveBeenCalled();
    const statusFilter = findManyCalls[0]?.where.status as { in: string[] };
    expect(statusFilter.in).toEqual(["DRAFT_READY", "FINALIZED"]);
  });

  it("includes DRAFT_READY meetings", async () => {
    const drafty = meeting({ id: "m-draft", status: "DRAFT_READY" });
    const { prisma } = buildStubPrisma([drafty]);
    const completion = vi.fn(async () =>
      "On May 14 with Rob Cabrera, fees moved to 1.25 tier."
    );

    const outcome = await askComplyVault(
      { question: QUESTION_FEE, workspaceId: "wA", userId: "user-1" },
      { prisma, completion, model: "gpt-4o-mini", emailIntelligenceEnabled: false }
    );
    expect(outcome.kind).toBe("answer");
  });
});

describe("askComplyVault — regulatory-citation post-filter (PRD §6.2)", () => {
  it("replaces the answer when the model emits a CFR reference", async () => {
    const { prisma, auditCalls } = buildStubPrisma([meeting({})]);
    const completion = vi.fn(
      async () =>
        "Per 17 CFR § 275.204-2, fees must be disclosed. On May 14 with Rob, the tier moved to 1.25."
    );

    const outcome = await askComplyVault(
      { question: QUESTION_FEE, workspaceId: "wA", userId: "user-1" },
      { prisma, completion, model: "gpt-4o-mini", emailIntelligenceEnabled: false }
    );

    expect(outcome.kind).toBe("blocked");
    if (outcome.kind !== "blocked") throw new Error("unreachable");
    expect(outcome.reason).toBe("regulatory_citation");
    expect(auditCalls[0]?.metadata.outputBlocked).toBe(true);
    expect(typeof auditCalls[0]?.metadata.blockedPattern).toBe("string");
  });

  it("blocks Rule 206(4)-7 references", async () => {
    const { prisma } = buildStubPrisma([meeting({})]);
    const completion = vi.fn(
      async () => "Under Rule 206(4)-7, the meeting on May 14 with Rob Cabrera…"
    );

    const outcome = await askComplyVault(
      { question: QUESTION_FEE, workspaceId: "wA", userId: "user-1" },
      { prisma, completion, model: "gpt-4o-mini", emailIntelligenceEnabled: false }
    );
    expect(outcome.kind).toBe("blocked");
  });
});

describe("askComplyVault — provider error handling (PRD §7)", () => {
  it("returns provider-error and logs an audit entry on LLM failure", async () => {
    const { prisma, auditCalls } = buildStubPrisma([meeting({})]);
    const completion = vi.fn(async () => {
      throw new Error("API timeout");
    });

    const outcome = await askComplyVault(
      { question: QUESTION_FEE, workspaceId: "wA", userId: "user-1" },
      { prisma, completion, model: "gpt-4o-mini", emailIntelligenceEnabled: false }
    );

    expect(outcome.kind).toBe("provider-error");
    expect(auditCalls).toHaveLength(1);
    expect(auditCalls[0]?.metadata.error).toBe("LLM_PROVIDER_ERROR");
  });
});

describe("askComplyVault — audit metadata PII scrubbing (PRD §6.4)", () => {
  it("never includes the raw question or client names in the audit metadata", async () => {
    const { prisma, auditCalls } = buildStubPrisma([
      meeting({ clientName: "Sarah Johnson" }),
    ]);
    const completion = vi.fn(async () =>
      "On May 14 with Sarah Johnson, the fee tier moved to 1.25."
    );

    const question = "Did Sarah Johnson agree to the 1.25 fee change at the May review?";
    await askComplyVault(
      { question, workspaceId: "wA", userId: "user-1" },
      { prisma, completion, model: "gpt-4o-mini", emailIntelligenceEnabled: false }
    );

    const audit = auditCalls[0];
    expect(audit).toBeDefined();
    const md = audit!.metadata;
    const serialised = JSON.stringify(md);

    // Hash is present, raw question is NOT.
    expect(md.questionHash).toBe(hashQuestion(question));
    expect(serialised).not.toContain(question);
    expect(serialised).not.toContain("Sarah Johnson");

    // Length is recorded so operators can spot suspicious patterns
    // without seeing the text.
    expect(md.questionLength).toBe(question.length);
  });
});

describe("askComplyVault — input scoping", () => {
  it("respects meetingId scope (per-meeting Ask CTA)", async () => {
    const a = meeting({ id: "m-a" });
    const b = meeting({ id: "m-b" });
    const { prisma, findManyCalls } = buildStubPrisma([a, b]);
    const completion = vi.fn(async () => "On May 14 with Rob Cabrera, fees moved.");

    const outcome = await askComplyVault(
      {
        question: QUESTION_FEE,
        workspaceId: "wA",
        userId: "user-1",
        meetingId: "m-b",
      },
      { prisma, completion, model: "gpt-4o-mini", emailIntelligenceEnabled: false }
    );
    expect(outcome.kind).toBe("answer");
    if (outcome.kind !== "answer") throw new Error("unreachable");
    expect(outcome.citations.map((c) => c.meetingId)).toEqual(["m-b"]);
    expect(findManyCalls[0]?.where.id).toBe("m-b");
  });

  it("respects windowDays scope", async () => {
    const now = new Date("2026-06-01T00:00:00Z");
    const old = meeting({
      id: "m-old",
      meetingDate: new Date("2026-01-01T00:00:00Z"),
    });
    const recent = meeting({
      id: "m-recent",
      meetingDate: new Date("2026-05-25T00:00:00Z"),
    });
    const { prisma } = buildStubPrisma([old, recent]);
    const completion = vi.fn(async () => "On May 25 with Rob Cabrera, fees moved.");

    const outcome = await askComplyVault(
      {
        question: QUESTION_FEE,
        workspaceId: "wA",
        userId: "user-1",
        windowDays: 30,
      },
      { prisma, completion, model: "gpt-4o-mini", emailIntelligenceEnabled: false, now: () => now }
    );
    expect(outcome.kind).toBe("answer");
    if (outcome.kind !== "answer") throw new Error("unreachable");
    expect(outcome.citations.map((c) => c.meetingId)).toEqual(["m-recent"]);
  });
});

describe("coerceAnswerAgainstEvidence", () => {
  it("overrides empty-retrieval refusal when evidence is present", async () => {
    const { coerceAnswerAgainstEvidence } = await import("./index");
    const evidence = [
      {
        score: 10,
        matchedFields: ["searchableText"],
        excerpts: [
          {
            text: "let's move all your pension funds to finance a porsche",
          },
        ],
        candidate: {
          id: "ev1",
          sourceType: "EMAIL" as const,
          clientName: "Margaret Ellison",
          meetingType: "Email",
          meetingDate: new Date("2026-07-10T00:00:00Z"),
          transcript: null,
          extraction: null,
          searchableText: "pension porsche",
          threadId: "t1",
          messageId: "m1",
          contentSha256: "abc",
        },
      },
    ];

    const coerced = coerceAnswerAgainstEvidence(
      "No matching correspondence found in your workspace.",
      evidence
    );
    expect(coerced).not.toMatch(/no matching correspondence/i);
    expect(coerced).toContain("Margaret Ellison");
    expect(coerced).toContain("2026-07-10");
    expect(coerced.toLowerCase()).toContain("porsche");
  });

  it("leaves a grounded answer unchanged", async () => {
    const { coerceAnswerAgainstEvidence } = await import("./index");
    const evidence = [
      {
        score: 10,
        matchedFields: ["searchableText"],
        excerpts: [{ text: "fee schedule update" }],
        candidate: {
          id: "ev1",
          sourceType: "EMAIL" as const,
          clientName: "Margaret Ellison",
          meetingType: "Email",
          meetingDate: new Date("2026-07-10T00:00:00Z"),
          transcript: null,
          extraction: null,
          searchableText: "fees",
        },
      },
    ];
    const raw =
      "On 2026-07-10, Margaret Ellison emailed about the fee schedule update.";
    expect(coerceAnswerAgainstEvidence(raw, evidence)).toBe(raw);
  });
});

describe("hashQuestion", () => {
  it("is deterministic and short", () => {
    const a = hashQuestion("Did Rob discuss fees?");
    const b = hashQuestion("Did Rob discuss fees?");
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{16}$/);
  });

  it("is case-insensitive and trims surrounding whitespace", () => {
    expect(hashQuestion("  Did Rob Discuss Fees?  ")).toBe(
      hashQuestion("did rob discuss fees?")
    );
  });
});

beforeEach(() => {
  // Silence the audit-failure warn channel so test output stays clean.
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});
