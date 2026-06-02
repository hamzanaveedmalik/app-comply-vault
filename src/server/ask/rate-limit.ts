/**
 * Ask ComplyVault — per-user rate limiter (PRD §3.1).
 *
 * Phase 1 is an in-memory sliding-window limiter keyed by
 * `${workspaceId}:${userId}`. Per-instance only — fine for the launch
 * (single-region Vercel) and easy to swap for Redis later without
 * touching the orchestrator.
 *
 * Default: 10 requests per 60s window. Override via env if needed.
 */

const DEFAULT_LIMIT = 10;
const DEFAULT_WINDOW_MS = 60_000;

type Bucket = number[]; // sorted ascending timestamps (ms)

const buckets = new Map<string, Bucket>();

export type RateLimitConfig = {
  limit?: number;
  windowMs?: number;
  now?: () => number;
};

export type RateLimitOutcome =
  | { allowed: true; remaining: number }
  | { allowed: false; retryAfterSec: number };

export function checkRateLimit(
  workspaceId: string,
  userId: string,
  config: RateLimitConfig = {}
): RateLimitOutcome {
  const limit = config.limit ?? readEnvInt("ASK_RATE_LIMIT_PER_MIN", DEFAULT_LIMIT);
  const windowMs = config.windowMs ?? DEFAULT_WINDOW_MS;
  const now = config.now ? config.now() : Date.now();
  const key = `${workspaceId}:${userId}`;

  const cutoff = now - windowMs;
  const existing = buckets.get(key) ?? [];
  // Drop expired entries.
  const live = existing.filter((t) => t > cutoff);

  if (live.length >= limit) {
    const oldest = live[0] ?? now;
    const retryAfterMs = Math.max(0, oldest + windowMs - now);
    buckets.set(key, live);
    return {
      allowed: false,
      retryAfterSec: Math.ceil(retryAfterMs / 1000),
    };
  }

  live.push(now);
  buckets.set(key, live);
  return { allowed: true, remaining: limit - live.length };
}

/**
 * Test helper — clears all buckets so unit tests don't share state.
 */
export function _resetRateLimitForTesting(): void {
  buckets.clear();
}

function readEnvInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}
