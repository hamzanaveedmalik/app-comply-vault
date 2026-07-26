/**
 * CV-TR-06a — parked ingests are durable, enumerable, and replayable.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

type ParkedRow = {
  id: string;
  workspaceId: string;
  source: string;
  externalRef: string;
  payload: Record<string, unknown>;
  occurredAt: Date | null;
  status: "PARKED" | "REPLAY_REQUESTED" | "INGESTED";
  parkedAt: Date;
  replayRequestedAt: Date | null;
  replayRequestedById: string | null;
  meetingId: string | null;
  deletedAt: Date | null;
};

const h = vi.hoisted(() => {
  const state: {
    rows: ParkedRow[];
    workspacePosture: "RETAIN" | "DISCARD" | null;
    nextId: number;
  } = { rows: [], workspacePosture: null, nextId: 1 };

  const auditCreates: Array<Record<string, unknown>> = [];
  const publishedJobs: Array<{ kind: string; payload: unknown }> = [];

  function matchWhere(row: ParkedRow, where: Record<string, unknown>): boolean {
    for (const [key, value] of Object.entries(where)) {
      if (key === "status" && typeof value === "object" && value !== null) {
        const not = (value as { not?: string }).not;
        if (not && row.status === not) return false;
        continue;
      }
      if ((row as Record<string, unknown>)[key] !== value) return false;
    }
    return true;
  }

  const parkedIngestOps = {
    upsert: async (args: {
      where: { workspaceId_source_externalRef: { workspaceId: string; source: string; externalRef: string } };
      create: Record<string, unknown>;
      update: Record<string, unknown>;
    }) => {
      const key = args.where.workspaceId_source_externalRef;
      const existing = state.rows.find(
        (r) =>
          r.workspaceId === key.workspaceId &&
          r.source === key.source &&
          r.externalRef === key.externalRef,
      );
      if (existing) {
        Object.assign(existing, args.update);
        return existing;
      }
      const row: ParkedRow = {
        id: `parked_${state.nextId++}`,
        status: "PARKED",
        parkedAt: new Date(),
        replayRequestedAt: null,
        replayRequestedById: null,
        meetingId: null,
        deletedAt: null,
        occurredAt: null,
        ...(args.create as object),
      } as ParkedRow;
      state.rows.push(row);
      return row;
    },
    updateMany: async (args: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
      let count = 0;
      for (const row of state.rows) {
        if (matchWhere(row, args.where)) {
          Object.assign(row, args.data);
          count++;
        }
      }
      return { count };
    },
    update: async (args: { where: { id: string }; data: Record<string, unknown> }) => {
      const row = state.rows.find((r) => r.id === args.where.id);
      if (row) Object.assign(row, args.data);
      return row;
    },
    findFirst: async (args: { where: Record<string, unknown> }) => {
      return state.rows.find((r) => matchWhere(r, args.where)) ?? null;
    },
    findMany: async (args: { where: Record<string, unknown> }) => {
      return state.rows.filter((r) => matchWhere(r, args.where));
    },
  };

  const auditEventOps = {
    create: async ({ data }: { data: Record<string, unknown> }) => {
      auditCreates.push(data);
      return data;
    },
  };

  return { state, auditCreates, publishedJobs, parkedIngestOps, auditEventOps };
});

const { state, auditCreates, publishedJobs } = h;

vi.mock("~/server/db", () => ({
  db: {
    parkedIngest: h.parkedIngestOps,
    auditEvent: h.auditEventOps,
    workspace: {
      findUnique: async () => ({ mediaPosture: h.state.workspacePosture }),
    },
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({ parkedIngest: h.parkedIngestOps, auditEvent: h.auditEventOps }),
  },
}));

vi.mock("~/server/qstash", () => ({
  publishZoomIngestionJob: async (payload: unknown) => {
    h.publishedJobs.push({ kind: "zoom", payload });
    return "job_zoom_1";
  },
  publishTeamsIngestionJob: async (payload: unknown) => {
    h.publishedJobs.push({ kind: "teams", payload });
    return "job_teams_1";
  },
}));

import {
  listParkedIngests,
  parkIngest,
  replayParkedIngest,
  resolveParkedIngest,
} from "./parked-ingest";

beforeEach(() => {
  state.rows = [];
  state.workspacePosture = null;
  auditCreates.length = 0;
  publishedJobs.length = 0;
  state.nextId = 1;
});

describe("parkIngest", () => {
  it("writes a durable row holding the replay payload plus an audit event", async () => {
    await parkIngest({
      workspaceId: "ws_1",
      source: "zoom",
      externalRef: "zoom-abc",
      payload: { zoomMeetingId: "zoom-abc", downloadToken: "tok" },
      occurredAt: new Date("2026-07-01T14:00:00Z"),
    });

    expect(state.rows).toHaveLength(1);
    expect(state.rows[0]?.status).toBe("PARKED");
    expect(state.rows[0]?.payload).toEqual({
      zoomMeetingId: "zoom-abc",
      downloadToken: "tok",
    });
    expect(auditCreates).toHaveLength(1);
    expect(auditCreates[0]?.action).toBe("INGEST_PARKED");
  });

  it("dedupes webhook retries on the source ref, keeping the fresh payload", async () => {
    await parkIngest({
      workspaceId: "ws_1",
      source: "zoom",
      externalRef: "zoom-abc",
      payload: { downloadToken: "stale" },
    });
    await parkIngest({
      workspaceId: "ws_1",
      source: "zoom",
      externalRef: "zoom-abc",
      payload: { downloadToken: "fresh" },
    });

    expect(state.rows).toHaveLength(1);
    expect(state.rows[0]?.payload).toEqual({ downloadToken: "fresh" });
  });
});

describe("listParkedIngests", () => {
  it("enumerates open parked items but not ingested ones", async () => {
    await parkIngest({
      workspaceId: "ws_1",
      source: "zoom",
      externalRef: "a",
      payload: {},
    });
    await parkIngest({
      workspaceId: "ws_1",
      source: "teams",
      externalRef: "b",
      payload: {},
    });
    await resolveParkedIngest({
      workspaceId: "ws_1",
      source: "teams",
      externalRef: "b",
      meetingId: "meeting_1",
    });

    const items = await listParkedIngests("ws_1");
    expect(items).toHaveLength(1);
    expect(items[0]?.externalRef).toBe("a");
  });
});

describe("replayParkedIngest", () => {
  async function parkOne(): Promise<string> {
    await parkIngest({
      workspaceId: "ws_1",
      source: "zoom",
      externalRef: "zoom-abc",
      payload: { zoomMeetingId: "zoom-abc" },
    });
    return state.rows[0]!.id;
  }

  it("rejects non-CCO actors", async () => {
    const id = await parkOne();
    const result = await replayParkedIngest({
      workspaceId: "ws_1",
      parkedIngestId: id,
      userId: "user_member",
      actorRole: "MEMBER",
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.status).toBe(403);
    expect(publishedJobs).toHaveLength(0);
  });

  it("refuses to replay before a posture decision exists", async () => {
    const id = await parkOne();
    state.workspacePosture = null;
    const result = await replayParkedIngest({
      workspaceId: "ws_1",
      parkedIngestId: id,
      userId: "user_cco",
      actorRole: "OWNER_CCO",
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.status).toBe(409);
    expect(publishedJobs).toHaveLength(0);
  });

  it("re-publishes the original job and records the replay in the audit trail", async () => {
    const id = await parkOne();
    state.workspacePosture = "RETAIN";
    auditCreates.length = 0;

    const result = await replayParkedIngest({
      workspaceId: "ws_1",
      parkedIngestId: id,
      userId: "user_cco",
      actorRole: "OWNER_CCO",
    });

    expect(result.success).toBe(true);
    expect(publishedJobs).toEqual([
      { kind: "zoom", payload: { zoomMeetingId: "zoom-abc" } },
    ]);
    expect(state.rows[0]?.status).toBe("REPLAY_REQUESTED");
    expect(state.rows[0]?.replayRequestedById).toBe("user_cco");
    expect(auditCreates.some((e) => e.action === "INGEST_REPLAYED")).toBe(true);
  });

  it("refuses to replay an already ingested item", async () => {
    const id = await parkOne();
    state.workspacePosture = "RETAIN";
    await resolveParkedIngest({
      workspaceId: "ws_1",
      source: "zoom",
      externalRef: "zoom-abc",
      meetingId: "meeting_1",
    });

    const result = await replayParkedIngest({
      workspaceId: "ws_1",
      parkedIngestId: id,
      userId: "user_cco",
      actorRole: "OWNER_CCO",
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.status).toBe(409);
  });
});

describe("resolveParkedIngest", () => {
  it("marks the parked row ingested and links the meeting", async () => {
    await parkIngest({
      workspaceId: "ws_1",
      source: "teams",
      externalRef: "teams-1",
      payload: {},
    });

    await resolveParkedIngest({
      workspaceId: "ws_1",
      source: "teams",
      externalRef: "teams-1",
      meetingId: "meeting_9",
    });

    expect(state.rows[0]?.status).toBe("INGESTED");
    expect(state.rows[0]?.meetingId).toBe("meeting_9");
  });
});
