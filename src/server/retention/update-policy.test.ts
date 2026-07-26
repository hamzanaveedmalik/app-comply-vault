/**
 * CV-TR-04 — Retention policy update: no-shortening guard.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const workspaceState = {
  id: "ws_1",
  retentionYears: 6,
  fiscalYearEndMonth: 12,
  fiscalTimezone: "America/New_York",
  legalHold: false,
};

const auditCreates: unknown[] = [];

vi.mock("~/server/db", () => ({
  db: {
    workspace: {
      findUnique: vi.fn(async () => ({ ...workspaceState })),
    },
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        workspace: {
          update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
            Object.assign(workspaceState, data);
            return { ...workspaceState };
          }),
        },
        auditEvent: {
          create: vi.fn(async ({ data }: { data: unknown }) => {
            auditCreates.push(data);
            return data;
          }),
        },
      };
      return fn(tx);
    }),
  },
}));

import { updateWorkspaceRetentionPolicy } from "./update-policy";

describe("CV-TR-04 updateWorkspaceRetentionPolicy", () => {
  beforeEach(() => {
    workspaceState.retentionYears = 6;
    workspaceState.fiscalYearEndMonth = 12;
    workspaceState.fiscalTimezone = "America/New_York";
    workspaceState.legalHold = false;
    auditCreates.length = 0;
  });

  it("rejects shortening retentionYears", async () => {
    const result = await updateWorkspaceRetentionPolicy({
      workspaceId: "ws_1",
      userId: "user_1",
      input: { retentionYears: 5 },
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toMatch(/cannot be shortened/i);
    }
  });

  it("allows increasing retentionYears and writes audit event", async () => {
    const result = await updateWorkspaceRetentionPolicy({
      workspaceId: "ws_1",
      userId: "user_1",
      input: { retentionYears: 7 },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.retentionYears).toBe(7);
      expect(result.data.expiryPreview).toContain("America/New_York");
    }
    expect(auditCreates.length).toBe(1);
  });
});
