import { beforeEach, describe, expect, it, vi } from "vitest";

const findManyAlias = vi.fn();
const findManyClient = vi.fn();
const findFirstMeeting = vi.fn();
const updateMeeting = vi.fn();
const $transaction = vi.fn();
const createAudit = vi.fn();
const getHouseholdClientIds = vi.fn();

vi.mock("~/server/db", () => ({
  db: {
    emailAlias: {
      findMany: (...args: unknown[]) => findManyAlias(...args),
    },
    client: {
      findMany: (...args: unknown[]) => findManyClient(...args),
      findFirst: vi.fn(),
    },
    meeting: {
      findFirst: (...args: unknown[]) => findFirstMeeting(...args),
      findMany: vi.fn(),
      update: (...args: unknown[]) => updateMeeting(...args),
    },
    auditEvent: {
      create: (...args: unknown[]) => createAudit(...args),
    },
    $transaction: (...args: unknown[]) => $transaction(...args),
  },
}));

vi.mock("~/server/clients/household", () => ({
  getHouseholdClientIds: (...args: unknown[]) => getHouseholdClientIds(...args),
}));

import {
  attributeMeeting,
  normalizeClientName,
  resolveClientFromExactName,
  resolveClientFromParticipantEmails,
} from "./client-attribution";

beforeEach(() => {
  findManyAlias.mockReset();
  findManyClient.mockReset();
  findFirstMeeting.mockReset();
  updateMeeting.mockReset();
  $transaction.mockReset();
  createAudit.mockReset();
  getHouseholdClientIds.mockReset();
});

describe("normalizeClientName", () => {
  it("trims and collapses whitespace", () => {
    expect(normalizeClientName("  Robert   Calloway  ")).toBe("robert calloway");
  });
});

describe("resolveClientFromParticipantEmails", () => {
  it("matches via EmailAlias (authoritative)", async () => {
    findManyAlias.mockResolvedValue([{ clientId: "client-a" }]);
    const outcome = await resolveClientFromParticipantEmails({
      workspaceId: "ws-1",
      emails: ["robert@example.com"],
    });
    expect(outcome).toEqual({
      status: "matched",
      clientId: "client-a",
      confidence: "EMAIL",
    });
  });

  it("does not cross workspaces (alias query is workspace-scoped)", async () => {
    findManyAlias.mockResolvedValue([]);
    const outcome = await resolveClientFromParticipantEmails({
      workspaceId: "ws-other",
      emails: ["robert@example.com"],
    });
    expect(findManyAlias).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ workspaceId: "ws-other" }),
      })
    );
    expect(outcome.status).toBe("unmatched");
  });

  it("sends multi-household participants to review (ambiguous)", async () => {
    findManyAlias.mockResolvedValue([
      { clientId: "client-a" },
      { clientId: "client-b" },
    ]);
    getHouseholdClientIds
      .mockResolvedValueOnce(["client-a"])
      .mockResolvedValueOnce(["client-b"]);
    const outcome = await resolveClientFromParticipantEmails({
      workspaceId: "ws-1",
      emails: ["a@example.com", "b@example.com"],
    });
    expect(outcome).toEqual({
      status: "ambiguous",
      reason: "participants_span_multiple_households",
    });
  });

  it("accepts multiple clients in the same household", async () => {
    findManyAlias.mockResolvedValue([
      { clientId: "client-a" },
      { clientId: "client-spouse" },
    ]);
    getHouseholdClientIds
      .mockResolvedValueOnce(["client-a", "client-spouse"])
      .mockResolvedValueOnce(["client-a", "client-spouse"]);
    const outcome = await resolveClientFromParticipantEmails({
      workspaceId: "ws-1",
      emails: ["a@example.com", "spouse@example.com"],
    });
    expect(outcome.status).toBe("matched");
    if (outcome.status === "matched") {
      expect(outcome.confidence).toBe("EMAIL");
    }
  });
});

describe("resolveClientFromExactName", () => {
  it("does not match nicknames (Bob vs Robert)", async () => {
    findManyClient.mockResolvedValue([{ id: "c1", name: "Robert Calloway" }]);
    const outcome = await resolveClientFromExactName({
      workspaceId: "ws-1",
      clientName: "Bob Calloway",
    });
    expect(outcome.status).toBe("unmatched");
  });

  it("does not match household-style combined names", async () => {
    findManyClient.mockResolvedValue([{ id: "c1", name: "Robert Calloway" }]);
    const outcome = await resolveClientFromExactName({
      workspaceId: "ws-1",
      clientName: "Robert & Susan Calloway",
    });
    expect(outcome.status).toBe("unmatched");
  });

  it("marks duplicate names in the same workspace as ambiguous", async () => {
    findManyClient.mockResolvedValue([
      { id: "c1", name: "Jordan Lee" },
      { id: "c2", name: "Jordan Lee" },
    ]);
    const outcome = await resolveClientFromExactName({
      workspaceId: "ws-1",
      clientName: "Jordan Lee",
    });
    expect(outcome).toEqual({
      status: "ambiguous",
      reason: "duplicate_client_names",
    });
  });

  it("matches exact normalised name with NAME_EXACT confidence", async () => {
    findManyClient.mockResolvedValue([{ id: "c1", name: "Robert Calloway" }]);
    const outcome = await resolveClientFromExactName({
      workspaceId: "ws-1",
      clientName: "  robert calloway ",
    });
    expect(outcome).toEqual({
      status: "matched",
      clientId: "c1",
      confidence: "NAME_EXACT",
    });
  });
});

describe("attributeMeeting", () => {
  it("prefers email pass and never name-guesses when emails are present but unmatched", async () => {
    findFirstMeeting.mockResolvedValue({
      id: "m1",
      clientName: "Robert Calloway",
      clientId: null,
      clientMatchConfidence: null,
      participantEmails: ["unknown@example.com"],
    });
    findManyAlias.mockResolvedValue([]);
    findManyClient.mockResolvedValue([{ id: "c1", name: "Robert Calloway" }]);

    const outcome = await attributeMeeting({
      meetingId: "m1",
      workspaceId: "ws-1",
    });

    expect(outcome.status).toBe("unmatched");
    expect(updateMeeting).not.toHaveBeenCalled();
    expect(findManyClient).not.toHaveBeenCalled();
  });

  it("falls back to name match only when there are no participant emails", async () => {
    findFirstMeeting.mockResolvedValue({
      id: "m1",
      clientName: "Robert Calloway",
      clientId: null,
      clientMatchConfidence: null,
      participantEmails: [],
    });
    findManyClient.mockResolvedValue([{ id: "c1", name: "Robert Calloway" }]);
    updateMeeting.mockResolvedValue({});

    const outcome = await attributeMeeting({
      meetingId: "m1",
      workspaceId: "ws-1",
    });

    expect(outcome).toEqual({
      status: "matched",
      clientId: "c1",
      confidence: "NAME_EXACT",
    });
    expect(updateMeeting).toHaveBeenCalledWith({
      where: { id: "m1" },
      data: { clientId: "c1", clientMatchConfidence: "NAME_EXACT" },
    });
  });

  it("keeps MANUAL attribution after a client rename (does not re-match by name)", async () => {
    findFirstMeeting.mockResolvedValue({
      id: "m1",
      clientName: "Old Name On Meeting",
      clientId: "c1",
      clientMatchConfidence: "MANUAL",
      participantEmails: [],
    });

    const outcome = await attributeMeeting({
      meetingId: "m1",
      workspaceId: "ws-1",
    });

    expect(outcome).toEqual({
      status: "matched",
      clientId: "c1",
      confidence: "MANUAL",
    });
    expect(findManyClient).not.toHaveBeenCalled();
    expect(updateMeeting).not.toHaveBeenCalled();
  });
});
