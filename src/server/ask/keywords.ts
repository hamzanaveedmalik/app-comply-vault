/**
 * Keyword extraction for Ask ComplyVault retrieval (Phase 1).
 *
 * Drops stopwords, normalises to lowercase, deduplicates, and keeps only
 * tokens that look meaningful for a substring search against `searchableText`.
 *
 * Phase 2 (semantic retrieval) replaces this with an embedding call; until
 * then we want a deterministic, dependency-free first pass.
 */

const STOPWORDS = new Set<string>([
  "a", "about", "above", "after", "again", "against", "all", "am", "an", "and",
  "any", "are", "as", "at", "be", "because", "been", "before", "being", "below",
  "between", "both", "but", "by", "can", "could", "did", "do", "does", "doing",
  "down", "during", "each", "few", "for", "from", "further", "had", "has",
  "have", "having", "he", "her", "here", "hers", "herself", "him", "himself",
  "his", "how", "i", "if", "in", "into", "is", "it", "its", "itself", "just",
  // "may" intentionally NOT a stopword — far more likely to be a month
  // reference ("the May review") than a modal verb in advisory questions.
  "me", "might", "more", "most", "must", "my", "myself", "no", "nor",
  "not", "now", "of", "off", "on", "once", "only", "or", "other", "ought",
  "our", "ours", "ourselves", "out", "over", "own", "same", "shall", "she",
  "should", "so", "some", "such", "than", "that", "the", "their", "theirs",
  "them", "themselves", "then", "there", "these", "they", "this", "those",
  "through", "to", "too", "under", "until", "up", "very", "was", "we", "were",
  "what", "when", "where", "which", "while", "who", "whom", "why", "will",
  "with", "would", "you", "your", "yours", "yourself", "yourselves", "ask",
]);

/**
 * Strip punctuation and split into lowercase tokens.
 * Keeps internal apostrophes ("don't") and hyphens ("soft-dollar") joined.
 */
function tokenize(input: string): string[] {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9'\-\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * Extract retrieval keywords from a natural-language question.
 *
 * - Lowercased, deduplicated, stopwords removed.
 * - Minimum length 2 chars (drops single-letter noise).
 * - Capped at 10 keywords to keep the OR query short.
 */
export function extractKeywords(question: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const token of tokenize(question)) {
    if (token.length < 2) continue;
    if (STOPWORDS.has(token)) continue;
    if (seen.has(token)) continue;
    seen.add(token);
    out.push(token);
    if (out.length >= 10) break;
  }
  return out;
}
