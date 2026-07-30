/**
 * Product feature flags. Env-gated so AdvizorStack demo and production can diverge.
 */

function isTruthyEnv(value: string | undefined): boolean {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

/** Email Intelligence (Phases 1–3): correspondence, classify→flag, Ask over email. */
export function isEmailIntelligenceEnabled(): boolean {
  return (
    isTruthyEnv(process.env.EMAIL_INTELLIGENCE_ENABLED) ||
    isTruthyEnv(process.env.NEXT_PUBLIC_EMAIL_INTELLIGENCE)
  );
}

/** Hybrid Ask retrieval (keyword + pgvector). Off until eval gate passes in deploy. */
export function isAskHybridRetrievalEnabled(): boolean {
  return isTruthyEnv(process.env.ASK_HYBRID_RETRIEVAL);
}

/**
 * Release 1 demo surfaces (Needs Attention, candidate pack, portfolio snapshot,
 * fail-closed demo, commercial pages). DoD: all new routes/UI gated.
 */
export function isRelease1DemoEnabled(): boolean {
  return (
    isTruthyEnv(process.env.RELEASE1_DEMO_ENABLED) ||
    isTruthyEnv(process.env.NEXT_PUBLIC_RELEASE1_DEMO)
  );
}
