import { describe, it, expect } from "vitest";
import {
  scanEmailForFlags,
  EMAIL_MEETING_TYPE,
  pickCounterparty,
  deriveNameFromAddress,
} from "./email-to-meeting-rules";

describe("scanEmailForFlags", () => {
  it("flags guaranteed-return language as CRITICAL", () => {
    const flags = scanEmailForFlags(
      "Great opportunity",
      "This fund is basically risk-free and I guarantee you a solid return.",
    );
    const types = flags.map((f) => f.type);
    expect(types).toContain("GUARANTEED_RETURN");
    const guaranteed = flags.find((f) => f.type === "GUARANTEED_RETURN");
    expect(guaranteed?.severity).toBe("CRITICAL");
    expect(guaranteed?.excerpt.length).toBeGreaterThan(0);
  });

  it("detects multiple distinct signals but never duplicates a type", () => {
    const flags = scanEmailForFlags(
      "Follow up",
      "I guarantee 20% annually. Also please just text me on WhatsApp going forward. I guarantee it.",
    );
    const types = flags.map((f) => f.type);
    expect(types).toContain("GUARANTEED_RETURN");
    expect(types).toContain("OFF_CHANNEL_REFERENCE");
    // GUARANTEED_RETURN appears twice in the text but only once as a flag.
    expect(types.filter((t) => t === "GUARANTEED_RETURN")).toHaveLength(1);
  });

  it("flags SSN sharing as sensitive PII", () => {
    const flags = scanEmailForFlags("Docs", "My SSN is 123-45-6789 for the account.");
    expect(flags.map((f) => f.type)).toContain("SENSITIVE_PII_SHARE");
  });

  it("returns no flags for benign content", () => {
    const flags = scanEmailForFlags(
      "Thanks",
      "Thank you for the meeting today, talk soon.",
    );
    expect(flags).toHaveLength(0);
  });

  it("exposes the distinguishing meeting type label", () => {
    expect(EMAIL_MEETING_TYPE).toBe("Email");
  });
});

describe("pickCounterparty", () => {
  const mailbox = "complyvaultco@gmail.com";

  it("prefers the external sender for inbound mail", () => {
    const cp = pickCounterparty({
      mailboxAddress: mailbox,
      fromAddress: "Jane Client <jane@acme.com>".replace(/.*<|>/g, ""),
      fromName: "Jane Client",
      toRecipients: [{ address: mailbox, name: "Compliance" }],
      ccRecipients: [],
    });
    expect(cp?.address).toBe("jane@acme.com");
    expect(cp?.name).toBe("Jane Client");
  });

  it("falls back to a recipient when the mailbox is the sender (outbound)", () => {
    const cp = pickCounterparty({
      mailboxAddress: mailbox,
      fromAddress: mailbox,
      fromName: "Compliance",
      toRecipients: [{ address: "bob@wealth.com", name: null }],
      ccRecipients: [],
    });
    expect(cp?.address).toBe("bob@wealth.com");
  });

  it("returns null when the only participant is the mailbox", () => {
    const cp = pickCounterparty({
      mailboxAddress: mailbox,
      fromAddress: mailbox,
      fromName: null,
      toRecipients: [{ address: mailbox, name: null }],
      ccRecipients: [],
    });
    expect(cp).toBeNull();
  });
});

describe("deriveNameFromAddress", () => {
  it("humanizes the local part", () => {
    expect(deriveNameFromAddress("john.doe@acme.com")).toBe("John Doe");
    expect(deriveNameFromAddress("sarah_okafor@x.io")).toBe("Sarah Okafor");
  });
});
