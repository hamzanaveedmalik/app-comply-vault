import { describe, expect, it } from "vitest";
import {
  hybridAtLeastAsGood,
  hybridScore,
  passesHybridThreshold,
  MIN_HYBRID_THRESHOLD,
} from "./hybrid";
import { scoreCandidateKeyword, rankAndExcerptHybrid } from "./retrieval";
import type { RetrievalCandidate } from "./types";
import { EMBEDDING_MODEL, EMBEDDING_MODEL_VERSION, vectorToSqlLiteral } from "./embeddings";

function candidate(partial: Partial<RetrievalCandidate> & { id: string }): RetrievalCandidate {
  return {
    sourceType: "EMAIL",
    clientName: "Robert Calloway",
    meetingDate: new Date("2026-05-01"),
    meetingType: "EMAIL",
    transcript: null,
    extraction: null,
    searchableText: "",
    ...partial,
  };
}

describe("hybridScore", () => {
  it("keeps strong keyword scores competitive without cosine", () => {
    const score = hybridScore({ keywordScore: 3, cosineSimilarity: null });
    expect(score).toBe(1);
    expect(passesHybridThreshold(score)).toBe(true);
  });

  it("boosts paraphrase matches via cosine when keywords miss", () => {
    const keywordOnly = hybridScore({
      keywordScore: 0,
      cosineSimilarity: null,
    });
    const hybrid = hybridScore({
      keywordScore: 0,
      cosineSimilarity: 0.82,
    });
    expect(keywordOnly).toBe(0);
    expect(hybrid).toBeGreaterThan(MIN_HYBRID_THRESHOLD);
    expect(passesHybridThreshold(hybrid)).toBe(true);
  });
});

describe("eval gate: hybrid >= keyword on seed + paraphrase queries", () => {
  const feeComplaint = candidate({
    id: "ev-fee",
    searchableText:
      "i am unhappy about the advisory fees you charge and want a reduction",
  });
  const unrelated = candidate({
    id: "ev-other",
    searchableText: "please find attached the quarterly statement for review",
  });

  const seedQueries = [
    {
      q: "Show me every email where a client mentioned fees",
      keywords: ["email", "client", "mentioned", "fees"],
      goldId: "ev-fee",
      cosine: 0.71,
    },
    {
      q: "anyone unhappy about what we charge",
      keywords: ["anyone", "unhappy", "charge"],
      goldId: "ev-fee",
      cosine: 0.88,
    },
    {
      q: "fee complaint from Robert",
      keywords: ["fee", "complaint", "robert"],
      goldId: "ev-fee",
      cosine: 0.75,
    },
    {
      q: "Did Rob discuss fee changes?",
      keywords: ["rob", "discuss", "fee", "changes"],
      goldId: "ev-fee",
      cosine: 0.6,
    },
    {
      q: "clients upset about pricing",
      keywords: ["clients", "upset", "pricing"],
      goldId: "ev-fee",
      cosine: 0.84,
    },
    {
      q: "advisory fee reduction request",
      keywords: ["advisory", "fee", "reduction", "request"],
      goldId: "ev-fee",
      cosine: 0.79,
    },
    {
      q: "unhappy with our charges",
      keywords: ["unhappy", "charges"],
      goldId: "ev-fee",
      cosine: 0.86,
    },
    {
      q: "mentioned the cost of advice",
      keywords: ["mentioned", "cost", "advice"],
      goldId: "ev-fee",
      cosine: 0.7,
    },
    {
      q: "quarterly statement attachment",
      keywords: ["quarterly", "statement", "attachment"],
      goldId: "ev-other",
      cosine: 0.9,
    },
    {
      q: "Has any advisor promised performance in writing?",
      keywords: ["advisor", "promised", "performance", "writing"],
      goldId: "ev-fee",
      cosine: 0.35,
    },
  ];

  it("is equal or better than keyword on every seed/paraphrase gold doc", () => {
    const now = new Date("2026-06-01");
    const keywordFound: boolean[] = [];
    const hybridFound: boolean[] = [];

    for (const seed of seedQueries) {
      const gold = seed.goldId === "ev-fee" ? feeComplaint : unrelated;
      const kw = scoreCandidateKeyword(gold, seed.keywords, now);
      const keywordOnlyRanked = rankAndExcerptHybrid(
        [feeComplaint, unrelated],
        seed.keywords,
        new Map(),
        now
      );
      const hybridRanked = rankAndExcerptHybrid(
        [feeComplaint, unrelated],
        seed.keywords,
        new Map([[gold.id, seed.cosine]]),
        now
      );

      const kwHit = keywordOnlyRanked.some((r) => r.candidate.id === gold.id);
      const hyHit = hybridRanked.some((r) => r.candidate.id === gold.id);
      keywordFound.push(kwHit);
      hybridFound.push(hyHit);

      // Hybrid must never lose a gold doc that keyword found.
      if (kwHit) {
        expect(hyHit).toBe(true);
      }
      // Paraphrase path: cosine alone must surface fee complaint when keywords miss.
      if (kw === 0 && seed.cosine >= 0.7 && seed.goldId === "ev-fee") {
        expect(hyHit).toBe(true);
      }
    }

    // Aggregate gate: hybrid success rate >= keyword success rate.
    const kwRate = keywordFound.filter(Boolean).length;
    const hyRate = hybridFound.filter(Boolean).length;
    expect(hyRate).toBeGreaterThanOrEqual(kwRate);
    expect(
      hybridAtLeastAsGood({
        keywordScores: keywordFound.map((v) => (v ? 1 : 0)),
        hybridScores: hybridFound.map((v) => (v ? 1 : 0)),
      })
    ).toBe(true);
  });

  it("drops semantic noise below threshold when keywords miss", () => {
    const ranked = rankAndExcerptHybrid(
      [unrelated],
      ["guaranteed", "returns"],
      new Map([["ev-other", 0.05]]),
      new Date()
    );
    expect(ranked).toHaveLength(0);
  });
});

describe("embedding metadata", () => {
  it("records model + version constants for each embedding", () => {
    expect(EMBEDDING_MODEL).toBe("text-embedding-3-small");
    expect(EMBEDDING_MODEL_VERSION).toBe("v1");
  });

  it("formats vectors for SQL without workspace post-filter", () => {
    const lit = vectorToSqlLiteral([0.1, 0.2, 0.3]);
    expect(lit).toBe("[0.1,0.2,0.3]");
  });
});
