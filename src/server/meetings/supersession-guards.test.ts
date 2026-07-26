/**
 * CV-TR-16 — supersession mutation guards.
 */

import { describe, expect, it } from "vitest";
import {
  assertSupersessionAllowsMutation,
  assertSupersessionAllowsUploadRetry,
  isSupersessionMutationBlocked,
} from "./supersession-guards";

describe("isSupersessionMutationBlocked", () => {
  it("blocks the superseded original", () => {
    expect(
      isSupersessionMutationBlocked({
        status: "FINALIZED",
        supersedesId: null,
        supersededById: "repl_1",
      }),
    ).toBe(true);
  });

  it("blocks a sealed replacement", () => {
    expect(
      isSupersessionMutationBlocked({
        status: "FINALIZED",
        supersedesId: "orig_1",
        supersededById: null,
      }),
    ).toBe(true);
  });

  it("allows an unsealed replacement draft (reprocess path)", () => {
    expect(
      isSupersessionMutationBlocked({
        status: "DRAFT",
        supersedesId: "orig_1",
        supersededById: null,
      }),
    ).toBe(false);
  });

  it("allows unrelated meetings", () => {
    expect(
      isSupersessionMutationBlocked({
        status: "DRAFT_READY",
        supersedesId: null,
        supersededById: null,
      }),
    ).toBe(false);
  });
});

describe("assertSupersessionAllowsUploadRetry", () => {
  it("blocks upload retry on replacement drafts", () => {
    const r = assertSupersessionAllowsUploadRetry({
      status: "DRAFT",
      supersedesId: "orig_1",
      supersededById: null,
    });
    expect(r.ok).toBe(false);
  });

  it("allows upload retry on unrelated drafts", () => {
    expect(
      assertSupersessionAllowsUploadRetry({
        status: "DRAFT",
        supersedesId: null,
        supersededById: null,
      }).ok,
    ).toBe(true);
  });
});

describe("assertSupersessionAllowsMutation", () => {
  it("returns 403 for superseded originals", () => {
    const r = assertSupersessionAllowsMutation({
      status: "FINALIZED",
      supersedesId: null,
      supersededById: "x",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.status).toBe(403);
      expect(r.error).toContain("supersession chain");
    }
  });
});
