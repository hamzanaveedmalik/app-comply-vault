/**
 * Hybrid retrieval scoring — keyword path kept; cosine added when available.
 */

export type HybridScoreInputs = {
  keywordScore: number;
  cosineSimilarity: number | null;
  /** Weights must sum conceptually to 1 for the match components. */
  keywordWeight?: number;
  cosineWeight?: number;
};

export const DEFAULT_KEYWORD_WEIGHT = 0.45;
export const DEFAULT_COSINE_WEIGHT = 0.55;
/** Below this hybrid score, treat as no match (exact names still win via keyword). */
export const MIN_HYBRID_THRESHOLD = 0.12;

/**
 * Combine keyword score (already includes recency) with cosine similarity.
 * Exact keyword hits remain competitive: a strong keyword score alone can pass threshold.
 */
export function hybridScore(input: HybridScoreInputs): number {
  const kwW = input.keywordWeight ?? DEFAULT_KEYWORD_WEIGHT;
  const cosW = input.cosineWeight ?? DEFAULT_COSINE_WEIGHT;
  const keywordNorm = Math.min(1, input.keywordScore / 3);
  const cosine = input.cosineSimilarity ?? 0;
  if (input.cosineSimilarity == null) {
    return keywordNorm;
  }
  return kwW * keywordNorm + cosW * cosine;
}

export function passesHybridThreshold(
  score: number,
  threshold: number = MIN_HYBRID_THRESHOLD
): boolean {
  return score >= threshold;
}

/**
 * Eval helper: for each seed query, hybrid must be >= keyword on the gold doc score.
 */
export function hybridAtLeastAsGood(args: {
  keywordScores: number[];
  hybridScores: number[];
}): boolean {
  if (args.keywordScores.length !== args.hybridScores.length) return false;
  return args.keywordScores.every((kw, i) => (args.hybridScores[i] ?? 0) >= kw - 1e-9);
}
