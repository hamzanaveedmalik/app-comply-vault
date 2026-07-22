import { afterEach, describe, expect, it, vi } from "vitest";
import type { ClientListItemDto } from "~/lib/types/clients";
import {
  attributeMeetingToClient,
  clientSelectOptions,
  fetchWorkspaceClients,
} from "./triage-attribution-api";

const sampleClients: ClientListItemDto[] = [
  {
    id: "client-a",
    name: "Robert Calloway",
    status: "ACTIVE",
    lastContactAt: null,
  },
  {
    id: "client-b",
    name: "Susan Calloway",
    status: "ACTIVE",
    lastContactAt: "2026-07-01T12:00:00.000Z",
  },
];

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchWorkspaceClients", () => {
  it("returns workspace clients for the attribution dropdown", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: sampleClients }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchWorkspaceClients("ws-1");

    expect(fetchMock).toHaveBeenCalledWith("/api/workspaces/ws-1/clients");
    expect(result).toEqual({ success: true, data: sampleClients });
    expect(clientSelectOptions(result.success ? result.data : [])).toEqual([
      { value: "client-a", label: "Robert Calloway" },
      { value: "client-b", label: "Susan Calloway" },
    ]);
  });

  it("returns an error when the workspace clients request fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ success: false, error: "Forbidden" }),
      }),
    );

    const result = await fetchWorkspaceClients("ws-other");

    expect(result).toEqual({ success: false, error: "Forbidden" });
  });
});

describe("attributeMeetingToClient", () => {
  it("submits manual meeting attribution", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await attributeMeetingToClient("meeting-1", "client-a");

    expect(fetchMock).toHaveBeenCalledWith("/api/meetings/attribution/meeting-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId: "client-a" }),
    });
    expect(result).toEqual({ success: true });
  });
});
