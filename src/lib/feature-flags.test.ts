import { describe, expect, it } from "vitest";
import { isEmailIntelligenceEnabled } from "~/lib/feature-flags";

describe("isEmailIntelligenceEnabled", () => {
  it("is false when unset", () => {
    delete process.env.EMAIL_INTELLIGENCE_ENABLED;
    delete process.env.NEXT_PUBLIC_EMAIL_INTELLIGENCE;
    expect(isEmailIntelligenceEnabled()).toBe(false);
  });

  it("is true for EMAIL_INTELLIGENCE_ENABLED=true", () => {
    process.env.EMAIL_INTELLIGENCE_ENABLED = "true";
    delete process.env.NEXT_PUBLIC_EMAIL_INTELLIGENCE;
    expect(isEmailIntelligenceEnabled()).toBe(true);
    delete process.env.EMAIL_INTELLIGENCE_ENABLED;
  });
});
