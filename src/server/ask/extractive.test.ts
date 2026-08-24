import { describe, expect, it } from "vitest";
import { buildExtractiveAnswer } from "./extractive";
import type { ScoredEvidence } from "./types";

describe("buildExtractiveAnswer", () => {
  it("includes client, date, and hash from evidence only", () => {
    const evidence: ScoredEvidence[] = [
      {
        score: 1,
        excerpts: [{ text: "the 1.00% advisory fee still applies" }],
        matchedFields: ["searchableText"],
        candidate: {
          id: "ev-1",
          sourceType: "EMAIL",
          clientName: "Marcus Holloway",
          meetingDate: new Date("2026-03-01T12:00:00.000Z"),
          meetingType: "Email",
          transcript: null,
          extraction: null,
          searchableText: "fee discussion",
          contentSha256: "abcdef0123456789deadbeef",
          threadId: "thr-1",
          messageId: "msg-1",
        },
      },
    ];
    const answer = buildExtractiveAnswer(evidence);
    expect(answer).toContain("Marcus Holloway");
    expect(answer).toContain("2026-03-01");
    expect(answer).toContain("abcdef01…");
    expect(answer).toContain("1.00% advisory fee");
    expect(answer.toLowerCase()).not.toMatch(/\bsec\b.*\brule\b/);
  });
});
