import { beforeEach, describe, expect, it, vi } from "vitest";

const findManyMemberships = vi.fn();
const findFirstMembership = vi.fn();
const findFirstClient = vi.fn();
const createHousehold = vi.fn();
const createMembership = vi.fn();
const createClient = vi.fn();
const updateMembership = vi.fn();
const createAudit = vi.fn();
const $transaction = vi.fn();
const updateAlias = vi.fn();
const findFirstAlias = vi.fn();
const updateManyTriage = vi.fn();
const backfillParticipantLinks = vi.fn();
const countHistoricalThreadsForAddress = vi.fn();
const upsertVerifiedAlias = vi.fn();

vi.mock("~/server/db", () => ({
  db: {
    clientHouseholdMember: {
      findMany: (...args: unknown[]) => findManyMemberships(...args),
      findFirst: (...args: unknown[]) => findFirstMembership(...args),
      create: (...args: unknown[]) => createMembership(...args),
      update: (...args: unknown[]) => updateMembership(...args),
    },
    clientHousehold: {
      create: (...args: unknown[]) => createHousehold(...args),
    },
    client: {
      findFirst: (...args: unknown[]) => findFirstClient(...args),
      create: (...args: unknown[]) => createClient(...args),
    },
    emailAlias: {
      findFirst: (...args: unknown[]) => findFirstAlias(...args),
      update: (...args: unknown[]) => updateAlias(...args),
    },
    emailTriageItem: {
      updateMany: (...args: unknown[]) => updateManyTriage(...args),
    },
    auditEvent: {
      create: (...args: unknown[]) => createAudit(...args),
    },
    $transaction: (...args: unknown[]) => $transaction(...args),
  },
}));

vi.mock("~/server/mailbox/participant-matching", () => ({
  backfillParticipantLinks: (...args: unknown[]) => backfillParticipantLinks(...args),
  countHistoricalThreadsForAddress: (...args: unknown[]) =>
    countHistoricalThreadsForAddress(...args),
  normalizeParticipantAddress: (a: string) => a.trim().toLowerCase(),
  upsertVerifiedAlias: (...args: unknown[]) => upsertVerifiedAlias(...args),
}));

import {
  addClientEmailAlias,
  getHouseholdClientIds,
  removeClientEmailAlias,
  removeHouseholdMember,
} from "./household";

beforeEach(() => {
  findManyMemberships.mockReset();
  findFirstMembership.mockReset();
  findFirstClient.mockReset();
  createHousehold.mockReset();
  createMembership.mockReset();
  createClient.mockReset();
  updateMembership.mockReset();
  createAudit.mockReset();
  $transaction.mockReset();
  updateAlias.mockReset();
  findFirstAlias.mockReset();
  updateManyTriage.mockReset();
  backfillParticipantLinks.mockReset();
  countHistoricalThreadsForAddress.mockReset();
  upsertVerifiedAlias.mockReset();
});

describe("getHouseholdClientIds", () => {
  it("returns only the client when not in a household", async () => {
    findManyMemberships.mockResolvedValueOnce([]);
    await expect(
      getHouseholdClientIds({ workspaceId: "ws-1", clientId: "c1" })
    ).resolves.toEqual(["c1"]);
  });

  it("includes spouse and joint peers", async () => {
    findManyMemberships
      .mockResolvedValueOnce([{ householdId: "hh-1" }])
      .mockResolvedValueOnce([
        { clientId: "c1" },
        { clientId: "spouse-1" },
        { clientId: "joint-1" },
      ]);

    const ids = await getHouseholdClientIds({
      workspaceId: "ws-1",
      clientId: "c1",
    });
    expect(ids.sort()).toEqual(["c1", "joint-1", "spouse-1"].sort());
  });
});

describe("addClientEmailAlias", () => {
  it("adds alias and retroactively attaches historical threads", async () => {
    findFirstClient.mockResolvedValue({ id: "c1" });
    upsertVerifiedAlias.mockResolvedValue(undefined);
    updateManyTriage.mockResolvedValue({ count: 1 });
    backfillParticipantLinks.mockResolvedValue({
      threadsUpdated: 3,
      evidenceAttached: 5,
    });
    createAudit.mockResolvedValue({});

    const result = await addClientEmailAlias({
      workspaceId: "ws-1",
      clientId: "c1",
      address: "Spouse@Example.com",
      userId: "user-1",
    });

    expect(result).toEqual({
      success: true,
      data: { threadsUpdated: 3, evidenceAttached: 5 },
    });
    expect(upsertVerifiedAlias).toHaveBeenCalledWith({
      workspaceId: "ws-1",
      address: "spouse@example.com",
      userId: null,
      clientId: "c1",
    });
    expect(backfillParticipantLinks).toHaveBeenCalledWith({
      workspaceId: "ws-1",
      address: "spouse@example.com",
      clientId: "c1",
    });
  });
});

describe("removeHouseholdMember", () => {
  it("soft-deletes membership without touching evidence", async () => {
    findFirstMembership.mockResolvedValue({
      id: "mem-1",
      householdId: "hh-1",
      clientId: "spouse-1",
      role: "SPOUSE",
    });
    $transaction.mockImplementation(async (ops: unknown[]) => ops);

    const result = await removeHouseholdMember({
      workspaceId: "ws-1",
      membershipId: "mem-1",
      userId: "user-1",
    });

    expect(result).toEqual({ success: true });
    expect(updateMembership).toHaveBeenCalledWith({
      where: { id: "mem-1" },
      data: { deletedAt: expect.any(Date) },
    });
    // No evidenceItem / clientActivity updates — history stays intact.
  });
});

describe("removeClientEmailAlias", () => {
  it("soft-deletes alias so future mail will not auto-match", async () => {
    findFirstAlias.mockResolvedValue({ id: "alias-1", clientId: "c1" });
    $transaction.mockImplementation(async (ops: unknown[]) => ops);

    const result = await removeClientEmailAlias({
      workspaceId: "ws-1",
      aliasId: "alias-1",
      userId: "user-1",
    });

    expect(result).toEqual({ success: true });
    expect(updateAlias).toHaveBeenCalledWith({
      where: { id: "alias-1" },
      data: { deletedAt: expect.any(Date) },
    });
  });
});
