import { beforeEach, describe, expect, it, vi } from "vitest";

const findManyMeetings = vi.fn();
const findManyClients = vi.fn();
const createClient = vi.fn();
const $transaction = vi.fn();

vi.mock("~/server/db", () => ({
  db: {
    meeting: {
      findMany: (...args: unknown[]) => findManyMeetings(...args),
    },
    client: {
      findMany: (...args: unknown[]) => findManyClients(...args),
      create: (...args: unknown[]) => createClient(...args),
    },
    $transaction: (...args: unknown[]) => $transaction(...args),
  },
}));

import {
  ensureClientRecordsForAttribution,
  listClientsForWorkspace,
} from "./queries";

beforeEach(() => {
  findManyMeetings.mockReset();
  findManyClients.mockReset();
  createClient.mockReset();
  $transaction.mockReset();
});

describe("ensureClientRecordsForAttribution", () => {
  it("creates Client rows from meeting names needing attribution", async () => {
    findManyMeetings.mockResolvedValue([
      { clientName: "Robert and Susan" },
      { clientName: "Robert and Susan" },
      { clientName: "Acme Family Trust" },
    ]);
    findManyClients.mockResolvedValue([]);
    $transaction.mockImplementation(async (ops: unknown[]) => {
      await Promise.all(ops as Promise<unknown>[]);
    });
    createClient.mockImplementation(({ data }: { data: { name: string } }) =>
      Promise.resolve({ id: `client-${data.name}`, ...data }),
    );

    await ensureClientRecordsForAttribution("ws-1");

    expect(createClient).toHaveBeenCalledTimes(2);
    expect(createClient).toHaveBeenCalledWith({
      data: {
        workspaceId: "ws-1",
        name: "Robert and Susan",
        status: "CLIENT",
      },
    });
    expect(createClient).toHaveBeenCalledWith({
      data: {
        workspaceId: "ws-1",
        name: "Acme Family Trust",
        status: "CLIENT",
      },
    });
  });

  it("skips names that already have a matching Client record", async () => {
    findManyMeetings.mockResolvedValue([{ clientName: "Robert and Susan" }]);
    findManyClients.mockResolvedValue([{ name: "Robert And Susan" }]);

    await ensureClientRecordsForAttribution("ws-1");

    expect($transaction).not.toHaveBeenCalled();
    expect(createClient).not.toHaveBeenCalled();
  });
});

describe("listClientsForWorkspace", () => {
  it("maps client rows to list DTOs", async () => {
    findManyClients.mockResolvedValue([
      {
        id: "client-a",
        name: "Robert and Susan",
        status: "CLIENT",
        lastContactAt: null,
      },
    ]);

    const rows = await listClientsForWorkspace("ws-1");

    expect(rows).toEqual([
      {
        id: "client-a",
        name: "Robert and Susan",
        status: "CLIENT",
        lastContactAt: null,
      },
    ]);
  });
});
