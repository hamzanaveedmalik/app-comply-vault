/**
 * CV-TR-04a — retention anchoring notice dismiss.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => {
  const state: {
    workspace: {
      id: string;
      retentionAnchoringNoticePending: boolean;
      retentionYears: number;
      fiscalYearEndMonth: number;
      fiscalTimezone: string;
    } | null;
  } = {
    workspace: {
      id: "ws_1",
      retentionAnchoringNoticePending: true,
      retentionYears: 6,
      fiscalYearEndMonth: 12,
      fiscalTimezone: "America/New_York",
    },
  };
  const auditCreates: Array<Record<string, unknown>> = [];

  const findUnique = async () =>
    state.workspace
      ? {
          retentionAnchoringNoticePending: state.workspace.retentionAnchoringNoticePending,
          retentionYears: state.workspace.retentionYears,
          fiscalYearEndMonth: state.workspace.fiscalYearEndMonth,
          fiscalTimezone: state.workspace.fiscalTimezone,
        }
      : null;

  const update = async ({ data }: { data: Record<string, unknown> }) => {
    if (state.workspace) Object.assign(state.workspace, data);
    return state.workspace;
  };

  const auditCreate = async ({ data }: { data: Record<string, unknown> }) => {
    auditCreates.push(data);
    return data;
  };

  return { state, auditCreates, findUnique, update, auditCreate };
});

vi.mock("~/server/db", () => ({
  db: {
    workspace: {
      findUnique: () => h.findUnique(),
      update: (args: { data: Record<string, unknown> }) => h.update(args),
    },
    auditEvent: {
      create: (args: { data: Record<string, unknown> }) => h.auditCreate(args),
    },
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        workspace: {
          update: (args: { data: Record<string, unknown> }) => h.update(args),
        },
        auditEvent: {
          create: (args: { data: Record<string, unknown> }) => h.auditCreate(args),
        },
      }),
  },
}));

import {
  dismissRetentionAnchoringNotice,
  getRetentionAnchoringNoticeState,
} from "./anchoring-notice";

beforeEach(() => {
  h.state.workspace = {
    id: "ws_1",
    retentionAnchoringNoticePending: true,
    retentionYears: 6,
    fiscalYearEndMonth: 12,
    fiscalTimezone: "America/New_York",
  };
  h.auditCreates.length = 0;
});

describe("getRetentionAnchoringNoticeState", () => {
  it("reports pending with fiscal year end label", async () => {
    const state = await getRetentionAnchoringNoticeState("ws_1");
    expect(state?.pending).toBe(true);
    expect(state?.fiscalYearEndLabel).toBe("December");
    expect(state?.retentionYears).toBe(6);
  });
});

describe("dismissRetentionAnchoringNotice", () => {
  it("rejects non-CCO actors", async () => {
    const result = await dismissRetentionAnchoringNotice({
      workspaceId: "ws_1",
      userId: "user_cm",
      actorRole: "MEMBER",
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.status).toBe(403);
    expect(h.state.workspace?.retentionAnchoringNoticePending).toBe(true);
    expect(h.auditCreates).toHaveLength(0);
  });

  it("clears the pending flag and writes an audit event for OWNER_CCO", async () => {
    const result = await dismissRetentionAnchoringNotice({
      workspaceId: "ws_1",
      userId: "user_cco",
      actorRole: "OWNER_CCO",
    });

    expect(result.success).toBe(true);
    expect(h.state.workspace?.retentionAnchoringNoticePending).toBe(false);
    expect(h.auditCreates).toHaveLength(1);
    expect(
      (h.auditCreates[0]?.metadata as Record<string, unknown>).action,
    ).toBe("retention_anchoring_notice_dismissed");
  });

  it("is idempotent when the notice is already dismissed", async () => {
    h.state.workspace!.retentionAnchoringNoticePending = false;
    const result = await dismissRetentionAnchoringNotice({
      workspaceId: "ws_1",
      userId: "user_cco",
      actorRole: "OWNER_CCO",
    });
    expect(result.success).toBe(true);
    expect(h.auditCreates).toHaveLength(0);
  });
});
