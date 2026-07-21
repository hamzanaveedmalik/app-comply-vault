import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const findFirst = vi.fn();
const update = vi.fn();

vi.mock("~/server/db", () => ({
  db: {
    mailboxConnection: {
      findFirst: (...args: unknown[]) => findFirst(...args),
      update: (...args: unknown[]) => update(...args),
    },
    integrationCredential: { upsert: vi.fn() },
    integrationConfig: { upsert: vi.fn() },
  },
}));

import {
  getConnectionAccessToken,
  encodeConnectionToken,
  refreshGmailToken,
} from "./gmail-auth";

const ENCRYPTION_KEY = "test-encryption-key-0123456789-abcdef";

beforeEach(() => {
  process.env.INTEGRATION_ENCRYPTION_KEY = ENCRYPTION_KEY;
  process.env.GMAIL_MAIL_CLIENT_ID = "client-id";
  process.env.GMAIL_MAIL_CLIENT_SECRET = "client-secret";
  process.env.NEXT_PUBLIC_APP_URL = "https://app.example.com";
  findFirst.mockReset();
  update.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("refreshGmailToken", () => {
  it("exchanges a refresh token for a fresh access token", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ access_token: "fresh-access", expires_in: 3600 }),
      }))
    );

    const result = await refreshGmailToken("refresh-1");
    expect(result?.accessToken).toBe("fresh-access");
    expect(result?.expiresAt).toBeInstanceOf(Date);
  });

  it("returns null when Google rejects the refresh", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 400 }))
    );
    expect(await refreshGmailToken("bad")).toBeNull();
  });
});

describe("getConnectionAccessToken", () => {
  it("returns the cached token when it is not near expiry", async () => {
    const encryptedToken = encodeConnectionToken({
      accessToken: "still-valid",
      refreshToken: "r1",
      expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    });
    findFirst.mockResolvedValue({ id: "c1", encryptedToken });

    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const token = await getConnectionAccessToken({
      workspaceId: "w1",
      connectionId: "c1",
    });

    expect(token).toBe("still-valid");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("refreshes and persists a re-encrypted bundle when expired", async () => {
    const encryptedToken = encodeConnectionToken({
      accessToken: "expired",
      refreshToken: "r1",
      expiresAt: new Date(Date.now() - 1000).toISOString(),
    });
    findFirst.mockResolvedValue({ id: "c1", encryptedToken });
    update.mockResolvedValue({});

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ access_token: "refreshed", expires_in: 3600 }),
      }))
    );

    const token = await getConnectionAccessToken({
      workspaceId: "w1",
      connectionId: "c1",
    });

    expect(token).toBe("refreshed");
    expect(update).toHaveBeenCalledTimes(1);
    const call = update.mock.calls[0]![0] as {
      data: { encryptedToken?: string };
    };
    expect(typeof call.data.encryptedToken).toBe("string");
  });

  it("throws when refresh fails so the caller can surface re-auth", async () => {
    const encryptedToken = encodeConnectionToken({
      accessToken: "expired",
      refreshToken: "r1",
      expiresAt: new Date(Date.now() - 1000).toISOString(),
    });
    findFirst.mockResolvedValue({ id: "c1", encryptedToken });

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 400 }))
    );

    await expect(
      getConnectionAccessToken({ workspaceId: "w1", connectionId: "c1" })
    ).rejects.toThrow(/reconnect/);
  });
});
