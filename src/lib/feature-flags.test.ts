import { describe, expect, it } from "vitest";
import {
  isAskHybridRetrievalEnabled,
  isEmailIntelligenceEnabled,
  isRelease1DemoEnabled,
} from "~/lib/feature-flags";

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

describe("isAskHybridRetrievalEnabled", () => {
  it("is false when unset", () => {
    delete process.env.ASK_HYBRID_RETRIEVAL;
    expect(isAskHybridRetrievalEnabled()).toBe(false);
  });

  it("is true when ASK_HYBRID_RETRIEVAL=true", () => {
    process.env.ASK_HYBRID_RETRIEVAL = "true";
    expect(isAskHybridRetrievalEnabled()).toBe(true);
    delete process.env.ASK_HYBRID_RETRIEVAL;
  });
});

describe("isRelease1DemoEnabled", () => {
  it("is false when unset", () => {
    delete process.env.RELEASE1_DEMO_ENABLED;
    delete process.env.NEXT_PUBLIC_RELEASE1_DEMO;
    expect(isRelease1DemoEnabled()).toBe(false);
  });

  it("is true when RELEASE1_DEMO_ENABLED=true", () => {
    process.env.RELEASE1_DEMO_ENABLED = "true";
    delete process.env.NEXT_PUBLIC_RELEASE1_DEMO;
    expect(isRelease1DemoEnabled()).toBe(true);
    delete process.env.RELEASE1_DEMO_ENABLED;
  });
});
