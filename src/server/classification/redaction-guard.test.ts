import { describe, expect, it } from "vitest";
import {
  redactForLlm,
  callLlmWithRedaction,
  assertRedactionGuardUsed,
  resetRedactionGuardForTests,
} from "./redaction-guard";

describe("redaction-guard", () => {
  it("redacts emails, phones, and dollar amounts", () => {
    const result = redactForLlm({
      bodyText: "Contact john@example.com or call 555-123-4567 about $12,500",
      fromAddress: "john@example.com",
      toAddresses: ["cco@firm.com"],
    });
    expect(result.text).not.toContain("john@example.com");
    expect(result.text).not.toContain("555-123-4567");
    expect(result.text).not.toContain("$12,500");
    expect(result.redactionCount).toBeGreaterThan(0);
  });

  it("requires callLlmWithRedaction wrapper for LLM calls", async () => {
    resetRedactionGuardForTests();
    expect(() => assertRedactionGuardUsed()).toThrow();

    await callLlmWithRedaction({
      bodyText: "Advice about portfolio",
      invoke: async (text) => {
        assertRedactionGuardUsed();
        return text;
      },
    });
  });
});
