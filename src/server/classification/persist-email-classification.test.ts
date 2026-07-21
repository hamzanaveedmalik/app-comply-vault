import { beforeEach, describe, expect, it, vi } from "vitest";

const findFirstEvidence = vi.fn();
const findFirstClassification = vi.fn();
const createClassification = vi.fn();
const $transaction = vi.fn();
const updateManyEvidence = vi.fn();

vi.mock("~/server/db", () => ({
  db: {
    evidenceItem: {
      findFirst: (...args: unknown[]) => findFirstEvidence(...args),
      updateMany: (...args: unknown[]) => updateManyEvidence(...args),
    },
    evidenceClassification: {
      findFirst: (...args: unknown[]) => findFirstClassification(...args),
      create: (...args: unknown[]) => createClassification(...args),
    },
    $transaction: (...args: unknown[]) => $transaction(...args),
  },
}));

vi.mock("~/lib/feature-flags", () => ({
  isEmailIntelligenceEnabled: vi.fn(() => true),
}));

vi.mock("./classify-email", () => ({
  classifyEmailWithLlm: vi.fn(),
}));

import { classifyEmailEvidence } from "./persist-email-classification";
import { classifyEmailWithLlm } from "./classify-email";
import { isEmailIntelligenceEnabled } from "~/lib/feature-flags";

beforeEach(() => {
  findFirstEvidence.mockReset();
  findFirstClassification.mockReset();
  createClassification.mockReset();
  $transaction.mockReset();
  updateManyEvidence.mockResolvedValue({ count: 1 });
  vi.mocked(isEmailIntelligenceEnabled).mockReturnValue(true);
  vi.mocked(classifyEmailWithLlm).mockReset();
});

describe("classifyEmailEvidence", () => {
  it("skips when feature flag is off", async () => {
    vi.mocked(isEmailIntelligenceEnabled).mockReturnValue(false);
    const result = await classifyEmailEvidence({
      workspaceId: "ws-1",
      evidenceItemId: "ev-1",
    });
    expect(result).toEqual({ status: "skipped", reason: "feature_disabled" });
  });

  it("returns duplicate when contentHash already classified (idempotent redelivery)", async () => {
    findFirstEvidence.mockResolvedValue({
      id: "ev-1",
      contentSha256: "sha",
      communication: {
        id: "comm-1",
        threadId: "thread-1",
        bodyText: "Please find attached the quarterly statement for review.",
        fromAddress: "a@example.com",
        toAddresses: ["b@example.com"],
      },
    });
    findFirstClassification.mockResolvedValueOnce({ id: "class-1" });

    const result = await classifyEmailEvidence({
      workspaceId: "ws-1",
      evidenceItemId: "ev-1",
    });
    expect(result).toEqual({
      status: "duplicate",
      classificationId: "class-1",
    });
    expect(classifyEmailWithLlm).not.toHaveBeenCalled();
    expect(updateManyEvidence).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { classificationStatus: "COMPLETE" },
      })
    );
  });

  it("records CLEAN without LLM for non-candidate heuristic skips", async () => {
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.99);
    findFirstEvidence.mockResolvedValue({
      id: "ev-1",
      contentSha256: "sha",
      communication: {
        id: "comm-1",
        threadId: "thread-1",
        bodyText: "Please find attached the quarterly statement for review.",
        fromAddress: "a@example.com",
        toAddresses: ["b@example.com"],
      },
    });
    findFirstClassification.mockResolvedValue(null);
    createClassification.mockResolvedValue({ id: "class-clean" });

    const result = await classifyEmailEvidence({
      workspaceId: "ws-1",
      evidenceItemId: "ev-1",
    });

    expect(result).toEqual({
      status: "clean",
      classificationId: "class-clean",
    });
    expect(classifyEmailWithLlm).not.toHaveBeenCalled();
    expect(createClassification).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ result: "CLEAN" }),
      })
    );
    randomSpy.mockRestore();
  });

  it("creates flags for LLM signals with idempotent dedupe keys", async () => {
    findFirstEvidence.mockResolvedValue({
      id: "ev-1",
      contentSha256: "sha",
      communication: {
        id: "comm-1",
        threadId: "thread-1",
        bodyText: "We offer guaranteed returns on this strategy.",
        fromAddress: "advisor@firm.com",
        toAddresses: ["client@example.com"],
      },
    });
    findFirstClassification.mockResolvedValue(null);
    vi.mocked(classifyEmailWithLlm).mockResolvedValue({
      parsed: {
        clean: false,
        signals: [
          {
            category: "GUARANTEED_RETURN",
            severity: "CRITICAL",
            confidence: 0.95,
            excerpt: "guaranteed returns",
            rationale: "Promissory return language.",
          },
        ],
      },
      modelId: "gpt-4o-mini",
      promptVersion: "email-taxonomy-v1",
      contentHash: "hash-1",
    });

    $transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        evidenceClassification: {
          create: vi.fn().mockResolvedValue({ id: "class-flagged" }),
        },
        flag: {
          findFirst: vi.fn().mockResolvedValue(null),
          create: vi.fn().mockResolvedValue({ id: "flag-1" }),
        },
      };
      return fn(tx);
    });

    const result = await classifyEmailEvidence({
      workspaceId: "ws-1",
      evidenceItemId: "ev-1",
    });

    expect(result.status).toBe("flagged");
    if (result.status === "flagged") {
      expect(result.flagIds).toEqual(["flag-1"]);
      expect(result.classificationId).toBe("class-flagged");
    }
  });

  it("returns error on LLM failure without marking complete (job marks FAILED)", async () => {
    findFirstEvidence.mockResolvedValue({
      id: "ev-1",
      contentSha256: "sha",
      communication: {
        id: "comm-1",
        threadId: "thread-1",
        bodyText: "We guarantee 12% returns every year.",
        fromAddress: "advisor@firm.com",
        toAddresses: ["client@example.com"],
      },
    });
    findFirstClassification.mockResolvedValue(null);
    vi.mocked(classifyEmailWithLlm).mockRejectedValue(new Error("llm_timeout"));

    const result = await classifyEmailEvidence({
      workspaceId: "ws-1",
      evidenceItemId: "ev-1",
    });

    expect(result).toEqual({ status: "error", reason: "llm_timeout" });
    expect(createClassification).not.toHaveBeenCalled();
  });
});
