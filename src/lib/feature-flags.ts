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
