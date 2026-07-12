import { describe, expect, it } from "vitest";
import { isFolderInScope } from "./scope";

describe("scope honors", () => {
  it("rejects folders not in scope", () => {
    expect(isFolderInScope("inbox-id", ["sent-id", "drafts-id"])).toBe(false);
  });

  it("allows folders in scope", () => {
    expect(isFolderInScope("inbox-id", ["inbox-id", "sent-id"])).toBe(true);
  });

  it("rejects empty scope", () => {
    expect(isFolderInScope("inbox-id", [])).toBe(false);
  });
});
