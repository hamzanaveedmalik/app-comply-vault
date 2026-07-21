/**
 * Gmail API client — labels (folders), message list backfill, history delta,
 * raw MIME, and attachments. Maps Gmail message JSON onto the canonical
 * MailMessage shape so the shared ingestion pipeline stays provider-agnostic.
 *
 * Delegated-only: all requests use the "me" userId of the authorized token.
 */

import type { GraphMailMessage } from "./graph-types";
import type {
  MailFolder,
  MailMessagesPage,
  MailAttachmentMeta,
} from "./providers/types";

const GMAIL_BASE = "https://gmail.googleapis.com/gmail/v1/users/me";

// Cursor scheme for Gmail delta (history-based). Stored in the same deltaCursor
// field M365 uses for @odata.deltaLink.
const HIST_PREFIX = "gmailhist:";

type GmailHeader = { name?: string; value?: string };

type GmailPart = {
  partId?: string;
  mimeType?: string;
  filename?: string;
  headers?: GmailHeader[];
  body?: { size?: number; data?: string; attachmentId?: string };
  parts?: GmailPart[];
};

type GmailMessageFull = {
  id: string;
  threadId?: string;
  labelIds?: string[];
  snippet?: string;
  historyId?: string;
  internalDate?: string;
  payload?: GmailPart;
};

function authHeaders(accessToken: string): HeadersInit {
  return { Authorization: `Bearer ${accessToken}` };
}

function base64UrlToBuffer(data: string): Buffer {
  return Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

function findHeader(headers: GmailHeader[], name: string): string | null {
  const found = headers.find(
    (h) => h.name?.toLowerCase() === name.toLowerCase()
  );
  return found?.value ?? null;
}

/** Parses an RFC822 address-list header into {address, name} entries. */
function parseAddressList(
  value: string | null
): Array<{ emailAddress: { address?: string; name?: string } }> {
  if (!value) return [];
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const match = /^(.*?)<([^>]+)>$/.exec(part);
      if (match?.[2]) {
        const name = (match[1] ?? "").trim().replace(/^"|"$/g, "");
        return { emailAddress: { address: match[2].trim(), name: name || undefined } };
      }
      return { emailAddress: { address: part } };
    });
}

/** Recursively collects attachment parts (filename + attachmentId). */
function collectAttachmentParts(part: GmailPart | undefined): GmailPart[] {
  if (!part) return [];
  const out: GmailPart[] = [];
  if (part.filename && part.body?.attachmentId) {
    out.push(part);
  }
  for (const child of part.parts ?? []) {
    out.push(...collectAttachmentParts(child));
  }
  return out;
}

/** Recursively finds the first body part matching a mime type. */
function findBodyPart(
  part: GmailPart | undefined,
  mimeType: string
): GmailPart | null {
  if (!part) return null;
  if (part.mimeType === mimeType && part.body?.data) return part;
  for (const child of part.parts ?? []) {
    const found = findBodyPart(child, mimeType);
    if (found) return found;
  }
  return null;
}

function mapGmailMessage(msg: GmailMessageFull): GraphMailMessage {
  const headers = msg.payload?.headers ?? [];
  const internalDateIso = msg.internalDate
    ? new Date(Number(msg.internalDate)).toISOString()
    : null;
  const dateHeader = findHeader(headers, "Date");
  const sentIso = dateHeader
    ? (() => {
        const d = new Date(dateHeader);
        return isNaN(d.getTime()) ? internalDateIso : d.toISOString();
      })()
    : internalDateIso;

  const htmlPart = findBodyPart(msg.payload, "text/html");
  const textPart = findBodyPart(msg.payload, "text/plain");
  let body: { contentType?: string; content?: string } | undefined;
  if (textPart?.body?.data) {
    body = {
      contentType: "text",
      content: base64UrlToBuffer(textPart.body.data).toString("utf8"),
    };
  } else if (htmlPart?.body?.data) {
    body = {
      contentType: "html",
      content: base64UrlToBuffer(htmlPart.body.data).toString("utf8"),
    };
  }

  const hasAttachments = collectAttachmentParts(msg.payload).length > 0;

  return {
    id: msg.id,
    conversationId: msg.threadId ?? null,
    internetMessageId: findHeader(headers, "Message-ID"),
    subject: findHeader(headers, "Subject"),
    bodyPreview: msg.snippet ?? null,
    body,
    from: parseAddressList(findHeader(headers, "From"))[0] ?? undefined,
    toRecipients: parseAddressList(findHeader(headers, "To")),
    ccRecipients: parseAddressList(findHeader(headers, "Cc")),
    sentDateTime: sentIso,
    receivedDateTime: internalDateIso,
    hasAttachments,
    internetMessageHeaders: headers.map((h) => ({
      name: h.name,
      value: h.value,
    })),
  };
}

async function getGmailMessage(
  accessToken: string,
  messageId: string
): Promise<GmailMessageFull> {
  const res = await fetch(
    `${GMAIL_BASE}/messages/${encodeURIComponent(messageId)}?format=full`,
    { headers: authHeaders(accessToken) }
  );
  if (!res.ok) {
    throw new Error(`Gmail get message failed: ${res.status}`);
  }
  return (await res.json()) as GmailMessageFull;
}

async function getProfileHistoryId(accessToken: string): Promise<string | null> {
  const res = await fetch(`${GMAIL_BASE}/profile`, {
    headers: authHeaders(accessToken),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { historyId?: string };
  return data.historyId ?? null;
}

export async function listGmailLabels(args: {
  accessToken: string;
}): Promise<MailFolder[]> {
  const res = await fetch(`${GMAIL_BASE}/labels`, {
    headers: authHeaders(args.accessToken),
  });
  if (!res.ok) {
    throw new Error(`Gmail list labels failed: ${res.status}`);
  }
  const data = (await res.json()) as {
    labels?: Array<{ id: string; name: string }>;
  };
  return (data.labels ?? []).map((l) => ({
    id: l.id,
    displayName: l.name,
    parentFolderId: null,
  }));
}

function toGmailDateQuery(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}/${m}/${d}`;
}

export async function fetchGmailMessagesPage(args: {
  accessToken: string;
  folderId: string;
  backfillFrom?: Date | null;
  nextLink?: string | null;
  pageSize?: number;
}): Promise<MailMessagesPage> {
  const params = new URLSearchParams({
    maxResults: String(args.pageSize ?? 50),
    labelIds: args.folderId,
  });
  if (args.nextLink) params.set("pageToken", args.nextLink);
  if (args.backfillFrom) {
    params.set("q", `after:${toGmailDateQuery(args.backfillFrom)}`);
  }

  const res = await fetch(`${GMAIL_BASE}/messages?${params.toString()}`, {
    headers: authHeaders(args.accessToken),
  });
  if (!res.ok) {
    throw new Error(`Gmail list messages failed: ${res.status}`);
  }
  const data = (await res.json()) as {
    messages?: Array<{ id: string; threadId?: string }>;
    nextPageToken?: string;
  };

  const value: GraphMailMessage[] = [];
  for (const ref of data.messages ?? []) {
    const full = await getGmailMessage(args.accessToken, ref.id);
    value.push(mapGmailMessage(full));
  }

  const nextLink = data.nextPageToken ?? null;
  // On the last page, capture the mailbox history baseline so delta sync can
  // start from here.
  let deltaLink: string | null = null;
  if (!nextLink) {
    const historyId = await getProfileHistoryId(args.accessToken);
    deltaLink = historyId ? `${HIST_PREFIX}${historyId}` : null;
  }

  return { value, nextLink, deltaLink };
}

function parseGmailCursor(
  cursor: string | null | undefined
): { startHistoryId: string | null; pageToken: string | null } {
  if (!cursor || !cursor.startsWith(HIST_PREFIX)) {
    return { startHistoryId: null, pageToken: null };
  }
  const rest = cursor.slice(HIST_PREFIX.length);
  const [historyPart, pagePart] = rest.split("|pt:");
  return {
    startHistoryId: historyPart || null,
    pageToken: pagePart || null,
  };
}

export async function fetchGmailDeltaPage(args: {
  accessToken: string;
  folderId: string;
  deltaLink?: string | null;
}): Promise<MailMessagesPage> {
  const { startHistoryId, pageToken } = parseGmailCursor(args.deltaLink);

  // No baseline yet: establish one and ingest nothing this run.
  if (!startHistoryId) {
    const historyId = await getProfileHistoryId(args.accessToken);
    return {
      value: [],
      nextLink: null,
      deltaLink: historyId ? `${HIST_PREFIX}${historyId}` : null,
    };
  }

  const params = new URLSearchParams({
    startHistoryId,
    labelId: args.folderId,
    historyTypes: "messageAdded",
  });
  if (pageToken) params.set("pageToken", pageToken);

  const res = await fetch(`${GMAIL_BASE}/history?${params.toString()}`, {
    headers: authHeaders(args.accessToken),
  });
  if (!res.ok) {
    throw new Error(`Gmail history sync failed: ${res.status}`);
  }
  const data = (await res.json()) as {
    history?: Array<{
      messagesAdded?: Array<{ message?: { id: string } }>;
    }>;
    historyId?: string;
    nextPageToken?: string;
  };

  const ids = new Set<string>();
  for (const h of data.history ?? []) {
    for (const added of h.messagesAdded ?? []) {
      if (added.message?.id) ids.add(added.message.id);
    }
  }

  const value: GraphMailMessage[] = [];
  for (const id of ids) {
    const full = await getGmailMessage(args.accessToken, id);
    value.push(mapGmailMessage(full));
  }

  if (data.nextPageToken) {
    // Keep the same startHistoryId while paginating this delta run.
    return {
      value,
      nextLink: `${HIST_PREFIX}${startHistoryId}|pt:${data.nextPageToken}`,
      deltaLink: null,
    };
  }

  // Last page: persist the new latest historyId as the next baseline.
  const newHistoryId = data.historyId ?? startHistoryId;
  return {
    value,
    nextLink: null,
    deltaLink: `${HIST_PREFIX}${newHistoryId}`,
  };
}

export async function fetchGmailMessageMime(args: {
  accessToken: string;
  messageId: string;
}): Promise<string> {
  const res = await fetch(
    `${GMAIL_BASE}/messages/${encodeURIComponent(args.messageId)}?format=raw`,
    { headers: authHeaders(args.accessToken) }
  );
  if (!res.ok) {
    throw new Error(`Gmail fetch MIME failed: ${res.status}`);
  }
  const data = (await res.json()) as { raw?: string };
  return data.raw ? base64UrlToBuffer(data.raw).toString("utf8") : "";
}

export async function listGmailMessageAttachments(args: {
  accessToken: string;
  messageId: string;
}): Promise<MailAttachmentMeta[]> {
  const full = await getGmailMessage(args.accessToken, args.messageId);
  return collectAttachmentParts(full.payload).map((p) => ({
    id: p.body!.attachmentId!,
    name: p.filename ?? "attachment",
    contentType: p.mimeType ?? "application/octet-stream",
    size: p.body?.size ?? 0,
  }));
}

export async function fetchGmailAttachmentContent(args: {
  accessToken: string;
  messageId: string;
  attachmentId: string;
}): Promise<Buffer> {
  const res = await fetch(
    `${GMAIL_BASE}/messages/${encodeURIComponent(args.messageId)}/attachments/${encodeURIComponent(args.attachmentId)}`,
    { headers: authHeaders(args.accessToken) }
  );
  if (!res.ok) {
    throw new Error(`Gmail fetch attachment failed: ${res.status}`);
  }
  const data = (await res.json()) as { data?: string };
  return data.data ? base64UrlToBuffer(data.data) : Buffer.alloc(0);
}

export { mapGmailMessage, parseGmailCursor, HIST_PREFIX };
