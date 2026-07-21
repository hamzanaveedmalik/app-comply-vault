import { afterEach, describe, expect, it, vi } from "vitest";
import {
  mapGmailMessage,
  parseGmailCursor,
  fetchGmailMessagesPage,
  HIST_PREFIX,
} from "./gmail-client";
import { threadKeyFromMessage } from "./thread-grouping";

function b64url(s: string): string {
  return Buffer.from(s, "utf8").toString("base64url");
}

const SAMPLE = {
  id: "m1",
  threadId: "t1",
  snippet: "Hi there",
  internalDate: "1700041200000",
  payload: {
    mimeType: "multipart/mixed",
    headers: [
      { name: "Subject", value: "Portfolio review" },
      { name: "From", value: "Alice Advisor <alice@firm.com>" },
      { name: "To", value: "bob@client.com, carol@client.com" },
      { name: "Cc", value: "dave@firm.com" },
      { name: "Message-ID", value: "<msg-1@firm.com>" },
      { name: "Date", value: "Wed, 15 Nov 2023 10:00:00 +0000" },
    ],
    parts: [
      {
        mimeType: "text/plain",
        body: { data: b64url("Hello body"), size: 10 },
      },
      {
        mimeType: "application/pdf",
        filename: "report.pdf",
        body: { attachmentId: "att-1", size: 1234 },
      },
    ],
  },
};

describe("gmail-client mapGmailMessage", () => {
  it("maps Gmail JSON to the canonical MailMessage shape", () => {
    const msg = mapGmailMessage(SAMPLE);
    expect(msg.id).toBe("m1");
    expect(msg.conversationId).toBe("t1");
    expect(msg.internetMessageId).toBe("<msg-1@firm.com>");
    expect(msg.subject).toBe("Portfolio review");
    expect(msg.from?.emailAddress?.address).toBe("alice@firm.com");
    expect(msg.from?.emailAddress?.name).toBe("Alice Advisor");
    expect(msg.toRecipients?.map((r) => r.emailAddress?.address)).toEqual([
      "bob@client.com",
      "carol@client.com",
    ]);
    expect(msg.ccRecipients?.map((r) => r.emailAddress?.address)).toEqual([
      "dave@firm.com",
    ]);
    expect(msg.body?.contentType).toBe("text");
    expect(msg.body?.content).toBe("Hello body");
    expect(msg.hasAttachments).toBe(true);
    expect(msg.receivedDateTime).toBe(
      new Date(1700041200000).toISOString()
    );
  });

  it("produces a thread key compatible with the shared grouping logic", () => {
    const msg = mapGmailMessage(SAMPLE);
    // Gmail threadId maps to conversationId, so grouping uses conv: keys.
    expect(threadKeyFromMessage(msg)).toBe("conv:t1");
  });

  it("marks messages without attachment parts as hasAttachments=false", () => {
    const noAtt = {
      id: "m2",
      threadId: "t2",
      internalDate: "1700041200000",
      payload: {
        mimeType: "text/plain",
        headers: [{ name: "Subject", value: "No files" }],
        body: { data: b64url("plain"), size: 5 },
      },
    };
    expect(mapGmailMessage(noAtt).hasAttachments).toBe(false);
  });
});

describe("gmail-client parseGmailCursor", () => {
  it("parses a bare history cursor", () => {
    expect(parseGmailCursor(`${HIST_PREFIX}123`)).toEqual({
      startHistoryId: "123",
      pageToken: null,
    });
  });

  it("parses a paginated history cursor", () => {
    expect(parseGmailCursor(`${HIST_PREFIX}123|pt:abc`)).toEqual({
      startHistoryId: "123",
      pageToken: "abc",
    });
  });

  it("returns nulls for missing or foreign cursors", () => {
    expect(parseGmailCursor(null)).toEqual({
      startHistoryId: null,
      pageToken: null,
    });
    expect(parseGmailCursor("https://graph.microsoft.com/delta")).toEqual({
      startHistoryId: null,
      pageToken: null,
    });
  });
});

describe("gmail-client fetchGmailMessagesPage (scope enforcement)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("only queries the requested label and records a delta baseline", async () => {
    const requestedUrls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        requestedUrls.push(url);
        if (url.includes("/messages?")) {
          return {
            ok: true,
            json: async () => ({ messages: [{ id: "m1" }] }),
          } as Response;
        }
        if (url.includes("/messages/m1")) {
          return { ok: true, json: async () => SAMPLE } as Response;
        }
        if (url.includes("/profile")) {
          return { ok: true, json: async () => ({ historyId: "999" }) } as Response;
        }
        throw new Error(`unexpected url ${url}`);
      })
    );

    const page = await fetchGmailMessagesPage({
      accessToken: "tok",
      folderId: "INBOX",
      backfillFrom: new Date("2023-01-01T00:00:00Z"),
    });

    const listUrl = requestedUrls.find((u) => u.includes("/messages?"))!;
    expect(listUrl).toContain("labelIds=INBOX");
    expect(listUrl).toContain("q=after%3A2023%2F01%2F01");
    // No other label should ever be queried.
    expect(requestedUrls.some((u) => u.includes("labelIds=SENT"))).toBe(false);

    expect(page.value).toHaveLength(1);
    expect(page.value[0]!.id).toBe("m1");
    expect(page.nextLink).toBeNull();
    expect(page.deltaLink).toBe(`${HIST_PREFIX}999`);
  });
});
