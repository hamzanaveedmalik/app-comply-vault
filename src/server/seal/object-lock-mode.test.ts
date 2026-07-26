/**
 * CV-TR-01 — Object Lock mode gating (fail closed to GOVERNANCE).
 */

import { describe, expect, it } from "vitest";
import { resolveSealedObjectLockMode } from "./object-lock-mode";

describe("resolveSealedObjectLockMode", () => {
  it("returns COMPLIANCE only when explicitly set", () => {
    expect(resolveSealedObjectLockMode("COMPLIANCE")).toBe("COMPLIANCE");
  });

  it("fails closed to GOVERNANCE for unset, empty, and typos", () => {
    expect(resolveSealedObjectLockMode(undefined)).toBe("GOVERNANCE");
    expect(resolveSealedObjectLockMode("")).toBe("GOVERNANCE");
    expect(resolveSealedObjectLockMode("compliance")).toBe("GOVERNANCE");
    expect(resolveSealedObjectLockMode("GOVERNANCE")).toBe("GOVERNANCE");
    expect(resolveSealedObjectLockMode("production")).toBe("GOVERNANCE");
  });
});
