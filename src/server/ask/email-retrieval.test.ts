/**
 * Email Intelligence Phase 3 — Ask over mailbox evidence.
 */

import { describe, expect, it, vi } from "vitest";
import { askComplyVault } from "./index";
import type { RetrievalCandidate } from "./types";
import { generateEmailSearchableText } from "~/server/search/email-searchable-text";

type StubMeetingRow = RetrievalCandidate & {
  workspaceId: string;
  status: string;
  deletedAt: Date | null;
};

type EmailRow = {
  id: string;
  title: string;
  occurredAt: Date;
  contentSha256: string;
  searchableText: string | null;
  workspaceId: string;
  client: { name: string } | null;
  communication: { id: string; threadId: string; direction: string } | null;
};

function buildDualStub(args: {
  meetings?: StubMeetingRow[];
  emails?: EmailRow[];
}) {
  const auditCalls: Array<{ metadata: Record<string, unknown> }> = [];
  const meetings = args.meetings ?? [];
  const emails = args.emails ?? [];

  const prisma = {
    meeting: {
      findMany: vi.fn(async (q: { where: Record<string, unknown>; take: number }) => {
        const where = q.where;
        return meetings
          .filter((m) => m.workspaceId === where.workspaceId)
          .filter((m) => {
            const status = where.status as { in: string[] } | undefined;
            if (!status) return true;
            return status.in.includes(m.status);
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
          .slice(0, q.take)
          .map(({ workspaceId: _w, status: _s, deletedAt: _d, ...rest }) => rest);
      }),
    },
    evidenceItem: {
      findMany: vi.fn(async (q: { where: Record<string, unknown>; take: number }) => {
        const where = q.where;
        return emails
          .filter((e) => e.workspaceId === where.workspaceId)
          .filter((e) => {
            const or = where.OR as
              | Array<{ searchableText: { contains: string } }>
              | undefined;
            if (!or || or.length === 0) return true;
            const haystack = (e.searchableText ?? "").toLowerCase();
            return or.some((clause) =>
              haystack.includes(clause.searchableText.contains.toLowerCase())
            );
          })
          .slice(0, q.take)
          .map(({ workspaceId: _w, ...rest }) => rest);
      }),
    },
    auditEvent: {
      create: vi.fn(async (args: { data: { metadata: Record<string, unknown> } }) => {
        auditCalls.push({ metadata: args.data.metadata });
        return { id: "audit" };
      }),
    },
  };

  return { prisma, auditCalls };
}

describe("generateEmailSearchableText", () => {
  it("indexes redacted body without raw email addresses", () => {
    const { searchableText } = generateEmailSearchableText({
      bodyText: "Please review the fee schedule emailed to robert@example.com",
      fromAddress: "advisor@firm.com",
      toAddresses: ["robert@example.com"],
      subject: "Fee schedule",
      classificationCategories: ["FEE_DISPUTE"],
    });
    expect(searchableText).toContain("fee");
    expect(searchableText).not.toContain("robert@example.com");
    expect(searchableText).toContain("[email]");
  });
});

describe("askComplyVault — email correspondence", () => {
  it("returns cited EMAIL results for fee questions", async () => {
    const indexed = generateEmailSearchableText({
      bodyText: "I am unhappy about the advisory fees charged this quarter.",
      fromAddress: "client@example.com",
      toAddresses: ["advisor@firm.com"],
      subject: "Fee question",
      classificationCategories: ["FEE_DISPUTE"],
    });

    const { prisma, auditCalls } = buildDualStub({
      emails: [
        {
          id: "ev-1",
          workspaceId: "wA",
          title: "Fee question",
          occurredAt: new Date("2026-05-02T12:00:00Z"),
          contentSha256: "abc123sha256hashvalue",
          searchableText: indexed.searchableText,
          client: { name: "Robert Calloway" },
          communication: {
            id: "comm-1",
            threadId: "thread-1",
            direction: "INBOUND",
          },
        },
      ],
    });

    const completion = vi.fn(
      async () =>
        "On May 2 Robert Calloway emailed about advisory fees (hash abc123sha256)."
    );

    const outcome = await askComplyVault(
      {
        question: "Show me every email where a client mentioned fees since April",
        workspaceId: "wA",
        userId: "user-1",
      },
      {
        prisma,
        completion,
        model: "gpt-4o-mini",
        emailIntelligenceEnabled: true,
      }
    );

    expect(outcome.kind).toBe("answer");
    if (outcome.kind !== "answer") throw new Error("unreachable");
    expect(outcome.citations[0]?.sourceType).toBe("EMAIL");
    expect(outcome.citations[0]?.threadId).toBe("thread-1");
    expect(outcome.citations[0]?.contentSha256).toBe("abc123sha256hashvalue");
    expect(outcome.citations[0]?.meetingId).toBe("thread-1");
    expect(auditCalls[0]?.metadata.retrievedEmailIds).toEqual(["comm-1"]);
  });

  it("returns no matching correspondence when email index is empty", async () => {
    const { prisma } = buildDualStub({ emails: [], meetings: [] });
    const completion = vi.fn(async () => "should not run");

    const outcome = await askComplyVault(
      {
        question: "When did we last hear from Robert Calloway and about what?",
        workspaceId: "wA",
        userId: "user-1",
      },
      {
        prisma,
        completion,
        model: "gpt-4o-mini",
        emailIntelligenceEnabled: true,
      }
    );

    expect(["no-evidence", "honest-miss"]).toContain(outcome.kind);
    if (outcome.kind === "no-evidence") {
      expect(outcome.reason).toBe("no-correspondence");
    } else if (outcome.kind === "honest-miss") {
      expect(outcome.message.length).toBeGreaterThan(0);
    }
    expect(completion).not.toHaveBeenCalled();
  });

  it("does not return another workspace's email", async () => {
    const indexed = generateEmailSearchableText({
      bodyText: "guaranteed returns in writing for Robert",
      fromAddress: "advisor@other.com",
      toAddresses: ["robert@other.com"],
      subject: "Performance",
    });

    const { prisma } = buildDualStub({
      emails: [
        {
          id: "ev-leak",
          workspaceId: "wB",
          title: "Performance",
          occurredAt: new Date("2026-05-02T12:00:00Z"),
          contentSha256: "leak-hash",
          searchableText: indexed.searchableText,
          client: { name: "Robert Calloway" },
          communication: {
            id: "comm-leak",
            threadId: "thread-leak",
            direction: "OUTBOUND",
          },
        },
      ],
    });

    const completion = vi.fn(async () => "should not run");
    const outcome = await askComplyVault(
      {
        question: "Has any advisor promised performance in writing?",
        workspaceId: "wA",
        userId: "user-1",
      },
      {
        prisma,
        completion,
        model: "gpt-4o-mini",
        emailIntelligenceEnabled: true,
      }
    );

    expect(["no-evidence", "honest-miss"]).toContain(outcome.kind);
    expect(completion).not.toHaveBeenCalled();
  });
});
