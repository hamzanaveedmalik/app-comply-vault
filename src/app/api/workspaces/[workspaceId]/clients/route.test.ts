import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();
const findFirstMembership = vi.fn();
const listClientsForWorkspace = vi.fn();

vi.mock("~/server/auth", () => ({
  auth: (...args: unknown[]) => authMock(...args),
}));

vi.mock("~/server/db", () => ({
  db: {
    userWorkspace: {
      findFirst: (...args: unknown[]) => findFirstMembership(...args),
    },
  },
}));

vi.mock("~/server/clients/queries", () => ({
  listClientsForWorkspace: (...args: unknown[]) => listClientsForWorkspace(...args),
}));

import { GET } from "./route";

beforeEach(() => {
  authMock.mockReset();
  findFirstMembership.mockReset();
  listClientsForWorkspace.mockReset();
});

describe("GET /api/workspaces/[workspaceId]/clients", () => {
  it("returns clients for an authorized workspace member", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    findFirstMembership.mockResolvedValue({ id: "membership-1" });
    listClientsForWorkspace.mockResolvedValue([
      { id: "client-a", name: "Robert Calloway", status: "ACTIVE", lastContactAt: null },
    ]);

    const res = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ workspaceId: "ws-1" }),
    });
    const json = (await res.json()) as { success: boolean; data?: unknown[] };

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data).toHaveLength(1);
    expect(listClientsForWorkspace).toHaveBeenCalledWith("ws-1");
  });

  it("rejects cross-workspace access", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    findFirstMembership.mockResolvedValue(null);

    const res = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ workspaceId: "ws-other" }),
    });
    const json = (await res.json()) as { success: boolean; error?: string };

    expect(res.status).toBe(403);
    expect(json.success).toBe(false);
    expect(listClientsForWorkspace).not.toHaveBeenCalled();
  });
});
