/**
 * CV-TR-01 — reconcile FINALIZED ↔ RecordSeal (never un-finalise).
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const meetingFindMany = vi.fn();
const recordSealFindMany = vi.fn();
const meetingUpdate = vi.fn();
const auditEventCreate = vi.fn();

vi.mock("~/server/db", () => ({
  db: {
    meeting: {
      findMany: (...args: unknown[]) => meetingFindMany(...args),
      update: (...args: unknown[]) => meetingUpdate(...args),
    },
    recordSeal: {
      findMany: (...args: unknown[]) => recordSealFindMany(...args),
    },
    auditEvent: {
      create: (...args: unknown[]) => auditEventCreate(...args),
    },
  },
}));

import { reconcileRecordSeals } from "./reconcile";

describe("reconcileRecordSeals", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("alerts when FINALIZED has no seal and never reverses status", async () => {
    meetingFindMany
      .mockResolvedValueOnce([
        { id: "m1", workspaceId: "w1" },
      ])
      // second call: meetings for seals
      .mockResolvedValueOnce([]);
    recordSealFindMany.mockResolvedValueOnce([]);

    const report = await reconcileRecordSeals(new Date("2026-07-26T05:15:00.000Z"));
    expect(report.finalizedWithoutSeal).toEqual([
      { meetingId: "m1", workspaceId: "w1" },
    ]);
    expect(report.alerts.length).toBe(1);
    expect(meetingUpdate).not.toHaveBeenCalled();
  });

  it("advances seal-without-FINALIZED to FINALIZED", async () => {
    meetingFindMany.mockImplementation(async (args: { where?: { status?: string; id?: { in?: string[] } } }) => {
      if (args?.where?.status === "FINALIZED") {
        return [];
      }
      if (args?.where?.id?.in?.includes("m2")) {
        return [
          {
            id: "m2",
            workspaceId: "w1",
            status: "CCO_SIGNED_OFF",
            finalizedAt: null,
            finalizedBy: null,
          },
        ];
      }
      return [];
    });
    recordSealFindMany.mockResolvedValue([
      {
        id: "seal1",
        meetingId: "m2",
        workspaceId: "w1",
        sealedAt: new Date("2026-07-26T04:00:00.000Z"),
        sealedByUserId: "user1",
      },
    ]);
    meetingUpdate.mockResolvedValue({});
    auditEventCreate.mockResolvedValue({});

    const report = await reconcileRecordSeals();
    expect(report.sealWithoutFinalized).toEqual([
      {
        meetingId: "m2",
        workspaceId: "w1",
        sealId: "seal1",
        advanced: true,
      },
    ]);
    expect(meetingUpdate).toHaveBeenCalledWith({
      where: { id: "m2" },
      data: {
        status: "FINALIZED",
        finalizedAt: new Date("2026-07-26T04:00:00.000Z"),
        finalizedBy: "user1",
      },
    });
  });
});
