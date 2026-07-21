import { describe, expect, it, vi } from "vitest";

// The M365 adapter transitively imports the Prisma client; stub it so the
// registry can be resolved without a database connection.
vi.mock("~/server/db", () => ({ db: {} }));

import { getMailProvider } from "./index";

describe("mail provider registry", () => {
  it("resolves the M365 adapter with the EMAIL_M365 channel", () => {
    const adapter = getMailProvider("M365");
    expect(adapter.channel).toBe("EMAIL_M365");
  });

  it("resolves the Gmail adapter with the EMAIL_GMAIL channel", () => {
    const adapter = getMailProvider("GMAIL");
    expect(adapter.channel).toBe("EMAIL_GMAIL");
  });

  it("throws for an unsupported provider", () => {
    // CAST: exercising the exhaustive-switch guard with an invalid value.
    expect(() => getMailProvider("SLACK" as never)).toThrow(
      /Unsupported mailbox provider/
    );
  });
});
