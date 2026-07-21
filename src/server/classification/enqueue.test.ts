import { beforeEach, describe, expect, it, vi } from "vitest";

const findFirstEvidence = vi.fn();
const updateManyEvidence = vi.fn();
const publishEmailClassificationJob = vi.fn();
const classifyEmailEvidence = vi.fn();

vi.mock("~/server/db", () => ({
  db: {
    evidenceItem: {
      findFirst: (...args: unknown[]) => findFirstEvidence(...args),
      updateMany: (...args: unknown[]) => updateManyEvidence(...args),
    },
  },
}));

vi.mock("~/lib/feature-flags", () => ({
  isEmailIntelligenceEnabled: vi.fn(() => true),
}));

vi.mock("~/server/qstash", () => ({
  publishEmailClassificationJob: (...args: unknown[]) =>
    publishEmailClassificationJob(...args),
}));

vi.mock("./persist-email-classification", () => ({
  classifyEmailEvidence: (...args: unknown[]) => classifyEmailEvidence(...args),
}));

vi.mock("./redaction-guard", () => ({
  redactForLlm: () => ({
    text: "redacted",
    contentHash: "hash-abc",
    redactions: [],
  }),
}));

import {
  clearClassificationQueueForTests,
  enqueueClassification,
  reclassifyEvidence,
  wasClassificationEnqueued,
} from "./enqueue";
import { isEmailIntelligenceEnabled } from "~/lib/feature-flags";
import { markClassificationFailed } from "./status";

beforeEach(() => {
  findFirstEvidence.mockReset();
  updateManyEvidence.mockResolvedValue({ count: 1 });
  publishEmailClassificationJob.mockReset();
  classifyEmailEvidence.mockReset();
  clearClassificationQueueForTests();
  vi.mocked(isEmailIntelligenceEnabled).mockReturnValue(true);
});

describe("enqueueClassification", () => {
  it("publishes QStash job with ids only and does not await LLM when queued", async () => {
    findFirstEvidence.mockResolvedValue({
      id: "ev-1",
      communication: {
        bodyText: "hello",
        fromAddress: "a@example.com",
        toAddresses: ["b@example.com"],
      },
    });
    publishEmailClassificationJob.mockResolvedValue("msg-1");

    await enqueueClassification({
      workspaceId: "ws-1",
      evidenceItemId: "ev-1",
    });

    expect(publishEmailClassificationJob).toHaveBeenCalledWith({
      workspaceId: "ws-1",
      evidenceItemId: "ev-1",
    });
    expect(classifyEmailEvidence).not.toHaveBeenCalled();
    expect(wasClassificationEnqueued("ws-1", "ev-1")).toBe(true);
  });

  it("does not throw when publish fails (ingest must continue)", async () => {
    findFirstEvidence.mockResolvedValue({
      id: "ev-1",
      communication: {
        bodyText: "hello",
        fromAddress: "a@example.com",
        toAddresses: ["b@example.com"],
      },
    });
    publishEmailClassificationJob.mockRejectedValue(new Error("qstash_down"));

    await expect(
      enqueueClassification({
        workspaceId: "ws-1",
        evidenceItemId: "ev-1",
      })
    ).resolves.toBeUndefined();
  });
});

describe("markClassificationFailed / reclassify", () => {
  it("marks FAILED on evidence item", async () => {
    await markClassificationFailed({
      workspaceId: "ws-1",
      evidenceItemId: "ev-1",
    });
    expect(updateManyEvidence).toHaveBeenCalledWith({
      where: {
        id: "ev-1",
        workspaceId: "ws-1",
        deletedAt: null,
      },
      data: { classificationStatus: "FAILED" },
    });
  });

  it("reclassify resets to PENDING and re-enqueues", async () => {
    findFirstEvidence
      .mockResolvedValueOnce({
        id: "ev-1",
        classificationStatus: "FAILED",
      })
      .mockResolvedValueOnce({
        id: "ev-1",
        communication: {
          bodyText: "hello",
          fromAddress: "a@example.com",
          toAddresses: ["b@example.com"],
        },
      });
    publishEmailClassificationJob.mockResolvedValue("msg-2");

    const result = await reclassifyEvidence({
      workspaceId: "ws-1",
      evidenceItemId: "ev-1",
    });

    expect(result).toEqual({ success: true });
    expect(publishEmailClassificationJob).toHaveBeenCalled();
  });
});
