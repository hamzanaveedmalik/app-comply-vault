import { beforeEach, describe, expect, it } from "vitest";
import { checkRateLimit, _resetRateLimitForTesting } from "./rate-limit";

describe("checkRateLimit", () => {
  beforeEach(() => {
    _resetRateLimitForTesting();
  });

  it("allows requests under the limit", () => {
    let t = 1_000_000;
    const now = () => t;
    for (let i = 0; i < 5; i++) {
      const r = checkRateLimit("w1", "u1", { limit: 5, windowMs: 60_000, now });
      expect(r.allowed).toBe(true);
    }
  });

  it("blocks the 11th request in the same minute (default limit 10)", () => {
    let t = 1_000_000;
    const now = () => t;
    for (let i = 0; i < 10; i++) {
      const r = checkRateLimit("w1", "u1", { limit: 10, windowMs: 60_000, now });
      expect(r.allowed).toBe(true);
      t += 10;
    }
    const blocked = checkRateLimit("w1", "u1", { limit: 10, windowMs: 60_000, now });
    expect(blocked.allowed).toBe(false);
    if (!blocked.allowed) {
      expect(blocked.retryAfterSec).toBeGreaterThan(0);
    }
  });

  it("isolates buckets per (workspace, user)", () => {
    let t = 1_000_000;
    const now = () => t;
    for (let i = 0; i < 5; i++) {
      checkRateLimit("w1", "u1", { limit: 5, windowMs: 60_000, now });
    }
    const otherUser = checkRateLimit("w1", "u2", { limit: 5, windowMs: 60_000, now });
    expect(otherUser.allowed).toBe(true);
    const otherWorkspace = checkRateLimit("w2", "u1", { limit: 5, windowMs: 60_000, now });
    expect(otherWorkspace.allowed).toBe(true);
  });

  it("recovers after the window expires", () => {
    let t = 1_000_000;
    const now = () => t;
    for (let i = 0; i < 5; i++) {
      checkRateLimit("w1", "u1", { limit: 5, windowMs: 60_000, now });
    }
    expect(
      checkRateLimit("w1", "u1", { limit: 5, windowMs: 60_000, now }).allowed
    ).toBe(false);
    t += 61_000;
    expect(
      checkRateLimit("w1", "u1", { limit: 5, windowMs: 60_000, now }).allowed
    ).toBe(true);
  });
});
