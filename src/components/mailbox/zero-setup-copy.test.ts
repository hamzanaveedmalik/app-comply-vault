import { describe, expect, it } from "vitest";
import { zeroSetupCopy } from "./zero-setup-copy";

describe("zeroSetupCopy", () => {
  it("never claims mailbox disclosure before sync", () => {
    const copy = zeroSetupCopy({ synced: false, totalOpenItems: 3 });
    expect(copy.cta).not.toMatch(/mailbox disclosed/i);
    expect(copy.body).toMatch(/not a live read of Gmail/i);
    expect(copy.heading).toMatch(/sync/i);
  });

  it("uses the N2 demo CTA after sync when open items exist", () => {
    const copy = zeroSetupCopy({ synced: true, totalOpenItems: 2 });
    expect(copy.cta).toBe("What the mailbox disclosed");
    expect(copy.body).toMatch(/held for confirmation/i);
  });

  it("falls back when synced but empty", () => {
    const copy = zeroSetupCopy({ synced: true, totalOpenItems: 0 });
    expect(copy.cta).toBe("Open Needs Attention");
  });
});
