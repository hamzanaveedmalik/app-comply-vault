import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const findFirstEmailAlias = vi.fn();
const findFirstUser = vi.fn();
const findFirstClient = vi.fn();
const findManyThreads = vi.fn();
const findManyCommunications = vi.fn();
const updateThread = vi.fn();
const updateEvidence = vi.fn();
const upsertTriage = vi.fn();
const createAlias = vi.fn();
const updateAlias = vi.fn();
const $transaction = vi.fn();

vi.mock("~/server/db", () => ({
  db: {
    emailAlias: {
      findFirst: (...args: unknown[]) => findFirstEmailAlias(...args),
      create: (...args: unknown[]) => createAlias(...args),
      update: (...args: unknown[]) => updateAlias(...args),
    },
    user: {
      findFirst: (...args: unknown[]) => findFirstUser(...args),
    },
    client: {
      findFirst: (...args: unknown[]) => findFirstClient(...args),
      create: vi.fn(),
      update: vi.fn(),
    },
    emailTriageItem: {
      upsert: (...args: unknown[]) => upsertTriage(...args),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    communicationThread: {
      findMany: (...args: unknown[]) => findManyThreads(...args),
      update: (...args: unknown[]) => updateThread(...args),
    },
    communication: {
      findMany: (...args: unknown[]) => findManyCommunications(...args),
    },
    evidenceItem: {
      update: (...args: unknown[]) => updateEvidence(...args),
    },
    clientActivity: {
      upsert: vi.fn(),
    },
    clientHouseholdMember: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    $transaction: (...args: unknown[]) => $transaction(...args),
  },
}));

vi.mock("~/server/integrations/zoho/crm-token", () => ({
  getValidZohoCrmContext: vi.fn().mockResolvedValue(null),
}));

vi.mock("~/server/integrations/zoho/crm-api", () => ({
  findContactIdByEmail: vi.fn(),
}));

vi.mock("~/lib/feature-flags", () => ({
  isEmailIntelligenceEnabled: vi.fn(() => true),
}));

vi.mock("~/server/clients/activity", () => ({
  recordEmailCorrespondenceActivity: vi.fn().mockResolvedValue(true),
}));

vi.mock("~/server/clients/household", () => ({
  getHouseholdClientIds: vi.fn(async ({ clientId }: { clientId: string }) => [
    clientId,
  ]),
}));

import {
  backfillParticipantLinks,
  countHistoricalThreadsForAddress,
  matchParticipantAddress,
  normalizeParticipantAddress,
  selectClientIdFromMatches,
  type ParticipantMatch,
} from "./participant-matching";
import { getHouseholdClientIds } from "~/server/clients/household";
import { recordEmailCorrespondenceActivity } from "~/server/clients/activity";

beforeEach(() => {
  findFirstEmailAlias.mockReset();
  findFirstUser.mockReset();
  findFirstClient.mockReset();
  findManyThreads.mockReset();
  findManyCommunications.mockReset();
  updateThread.mockReset();
  updateEvidence.mockReset();
  upsertTriage.mockReset();
  createAlias.mockReset();
  updateAlias.mockReset();
  $transaction.mockReset();
  vi.mocked(getHouseholdClientIds).mockImplementation(
    async ({ clientId }: { clientId: string }) => [clientId]
  );
  vi.mocked(recordEmailCorrespondenceActivity).mockClear();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("normalizeParticipantAddress", () => {
  it("trims and lowercases", () => {
    expect(normalizeParticipantAddress("  Robert@Example.COM ")).toBe(
      "robert@example.com"
    );
  });
});

describe("selectClientIdFromMatches", () => {
  it("returns the first matched client among mixed participants", () => {
    const matches: ParticipantMatch[] = [
      {
        address: "unknown@example.com",
        userId: null,
        clientId: null,
        verified: false,
        source: "triage",
      },
      {
        address: "robert@example.com",
        userId: null,
        clientId: "client-robert",
        verified: true,
        source: "client",
      },
      {
        address: "advisor@firm.com",
        userId: "user-1",
        clientId: null,
        verified: true,
        source: "user",
      },
    ];
    expect(selectClientIdFromMatches(matches)).toBe("client-robert");
  });

  it("returns null when nothing matched a client", () => {
    expect(
      selectClientIdFromMatches([
        {
          address: "a@example.com",
          userId: null,
          clientId: null,
          verified: false,
          source: "triage",
        },
      ])
    ).toBeNull();
  });
});

describe("matchParticipantAddress", () => {
  it("matches any EmailAlias for a multi-address client", async () => {
    findFirstEmailAlias
      .mockResolvedValueOnce(null) // verified lookup
      .mockResolvedValueOnce({ clientId: "client-1" }) // client alias
      .mockResolvedValueOnce(null); // upsertVerifiedAlias → create
    findFirstUser.mockResolvedValue(null);
    createAlias.mockResolvedValue({});

    const match = await matchParticipantAddress({
      workspaceId: "ws-1",
      address: "robert.alt@example.com",
    });

    expect(match.clientId).toBe("client-1");
    expect(match.source).toBe("client");
    expect(match.verified).toBe(true);
  });

  it("tags household members when the client sits in a multi-person household", async () => {
    findFirstEmailAlias
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ clientId: "spouse-1" })
      .mockResolvedValueOnce(null);
    findFirstUser.mockResolvedValue(null);
    createAlias.mockResolvedValue({});
    vi.mocked(getHouseholdClientIds).mockResolvedValue([
      "primary-1",
      "spouse-1",
    ]);

    const match = await matchParticipantAddress({
      workspaceId: "ws-1",
      address: "jane@example.com",
    });

    expect(match.clientId).toBe("spouse-1");
    expect(match.source).toBe("household");
  });

  it("queues unmatched addresses for triage", async () => {
    findFirstEmailAlias.mockResolvedValue(null);
    findFirstUser.mockResolvedValue(null);
    upsertTriage.mockResolvedValue({});

    const match = await matchParticipantAddress({
      workspaceId: "ws-1",
      address: "unknown@example.com",
    });

    expect(match.source).toBe("triage");
    expect(match.clientId).toBeNull();
    expect(upsertTriage).toHaveBeenCalled();
  });
});

describe("countHistoricalThreadsForAddress", () => {
  it("counts threads that include the address", async () => {
    findManyThreads.mockResolvedValue([
      {
        participants: [
          { address: "unknown@example.com" },
          { address: "advisor@firm.com" },
        ],
      },
      { participants: [{ address: "other@example.com" }] },
      {
        participants: [{ address: "Unknown@Example.com" }],
      },
    ]);

    const count = await countHistoricalThreadsForAddress({
      workspaceId: "ws-1",
      address: "unknown@example.com",
    });
    expect(count).toBe(2);
  });
});

describe("backfillParticipantLinks", () => {
  it("updates thread participants and retroactively attaches evidence", async () => {
    findManyThreads.mockResolvedValue([
      {
        id: "thread-1",
        participants: [
          { address: "unknown@example.com", clientId: null },
          { address: "advisor@firm.com", clientId: null },
        ],
      },
    ]);
    updateThread.mockResolvedValue({});
    findManyCommunications.mockResolvedValue([
      {
        id: "msg-1",
        threadId: "thread-1",
        direction: "INBOUND",
        sentAt: new Date("2026-04-01T12:00:00Z"),
        fromAddress: "unknown@example.com",
        toAddresses: ["advisor@firm.com"],
        ccAddresses: [],
        evidenceItem: {
          id: "ev-1",
          title: "Fee question",
          contentSha256: "abc123",
          occurredAt: new Date("2026-04-01T12:00:00Z"),
        },
      },
    ]);
    updateEvidence.mockResolvedValue({});

    const result = await backfillParticipantLinks({
      workspaceId: "ws-1",
      address: "unknown@example.com",
      clientId: "client-robert",
    });

    expect(result.threadsUpdated).toBe(1);
    expect(result.evidenceAttached).toBe(1);
    expect(updateEvidence).toHaveBeenCalledWith({
      where: { id: "ev-1" },
      data: { clientId: "client-robert" },
    });
    expect(recordEmailCorrespondenceActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        clientId: "client-robert",
        evidenceItemId: "ev-1",
        fromTriage: true,
      })
    );
  });

  it("does not reassign evidence that already has a clientId", async () => {
    findManyThreads.mockResolvedValue([]);
    findManyCommunications.mockResolvedValue([]);

    const result = await backfillParticipantLinks({
      workspaceId: "ws-1",
      address: "unknown@example.com",
      clientId: "client-robert",
    });

    expect(result.evidenceAttached).toBe(0);
    expect(updateEvidence).not.toHaveBeenCalled();
    // Query must constrain to null clientId
    expect(findManyCommunications).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          evidenceItem: expect.objectContaining({ clientId: null }),
        }),
      })
    );
  });
});
