import { beforeEach, describe, expect, it, vi } from "vitest";

const findManyMemberships = vi.fn();

vi.mock("~/server/db", () => ({
  db: {
    clientHouseholdMember: {
      findMany: (...args: unknown[]) => findManyMemberships(...args),
    },
  },
}));

import { getHouseholdClientIds } from "./household";

beforeEach(() => {
  findManyMemberships.mockReset();
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
