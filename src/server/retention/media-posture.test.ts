/**
 * CV-TR-06 / CV-TR-06a — media posture gate and decision recording.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

type PostureValue = "RETAIN" | "DISCARD" | null;

const state: {
  workspace: {
    id: string;
    mediaPosture: PostureValue;
    postureSetAt: Date | null;
    postureSetById: string | null;
  } | null;
} = {
  workspace: {
    id: "ws_1",
    mediaPosture: null,
    postureSetAt: null,
    postureSetById: null,
  },
};

const auditCreates: Array<Record<string, unknown>> = [];

vi.mock("~/server/db", () => ({
  db: {
    workspace: {
      findUnique: vi.fn(async () =>
        state.workspace ? { ...state.workspace } : null,
      ),
    },
    auditEvent: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        auditCreates.push(data);
        return data;
      }),
    },
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        workspace: {
          update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
            if (state.workspace) Object.assign(state.workspace, data);
            return state.workspace;
          }),
        },
        auditEvent: {
          create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
            auditCreates.push(data);
            return data;
          }),
        },
      };
      return fn(tx);
    }),
  },
}));

import {
  assertMediaPostureSet,
  getMediaPostureState,
  setMediaPosture,
} from "./media-posture";

describe("CV-TR-06 media posture gate", () => {
  beforeEach(() => {
    state.workspace = {
      id: "ws_1",
      mediaPosture: null,
      postureSetAt: null,
      postureSetById: null,
    };
    auditCreates.length = 0;
  });

  it("blocks ingest when no posture is recorded", async () => {
    const gate = await assertMediaPostureSet("ws_1");
    expect(gate.ok).toBe(false);
    if (!gate.ok) {
      expect(gate.status).toBe(409);
      expect(gate.error).toMatch(/blocked until/i);
    }
  });

  it("allows ingest once a posture exists", async () => {
    state.workspace!.mediaPosture = "DISCARD";
    const gate = await assertMediaPostureSet("ws_1");
    expect(gate.ok).toBe(true);
    if (gate.ok) {
      expect(gate.posture).toBe("DISCARD");
    }
  });

  it("fails closed for an unknown workspace", async () => {
    state.workspace = null;
    const gate = await assertMediaPostureSet("ws_missing");
    expect(gate.ok).toBe(false);
    if (!gate.ok) {
      expect(gate.status).toBe(404);
    }
  });

  it("reports blocked state for the banner", async () => {
    const result = await getMediaPostureState("ws_1");
    expect(result?.ingestBlocked).toBe(true);
    expect(result?.posture).toBeNull();
  });

});

describe("CV-TR-06 setMediaPosture", () => {
  beforeEach(() => {
    state.workspace = {
      id: "ws_1",
      mediaPosture: null,
      postureSetAt: null,
      postureSetById: null,
    };
    auditCreates.length = 0;
  });

  it("rejects a non-CCO actor", async () => {
    const result = await setMediaPosture({
      workspaceId: "ws_1",
      userId: "user_cm",
      actorRole: "MEMBER",
      posture: "DISCARD",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.status).toBe(403);
    }
    expect(auditCreates).toHaveLength(0);
  });

  it("records the decision and writes an audit event with actor and timestamp", async () => {
    const result = await setMediaPosture({
      workspaceId: "ws_1",
      userId: "user_cco",
      actorRole: "OWNER_CCO",
      posture: "DISCARD",
    });

    expect(result.success).toBe(true);
    expect(state.workspace?.mediaPosture).toBe("DISCARD");
    expect(state.workspace?.postureSetById).toBe("user_cco");
    expect(state.workspace?.postureSetAt).toBeInstanceOf(Date);

    expect(auditCreates).toHaveLength(1);
    expect(auditCreates[0]?.userId).toBe("user_cco");
    const metadata = auditCreates[0]?.metadata as Record<string, unknown>;
    expect(metadata.newPosture).toBe("DISCARD");
    expect(metadata.previousPosture).toBeNull();
  });

  it("states unrecoverability when switching DISCARD to RETAIN", async () => {
    state.workspace!.mediaPosture = "DISCARD";

    const result = await setMediaPosture({
      workspaceId: "ws_1",
      userId: "user_cco",
      actorRole: "OWNER_CCO",
      posture: "RETAIN",
    });

    expect(result.success).toBe(true);
    const metadata = auditCreates[0]?.metadata as Record<string, unknown>;
    expect(String(metadata.note)).toMatch(/unrecoverable/i);
  });
});
