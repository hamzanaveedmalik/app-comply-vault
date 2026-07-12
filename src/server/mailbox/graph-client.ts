/**
 * Microsoft Graph mail API client — folders, messages, delta sync.
 * Epic B CV-B-02, CV-B-04
 */

import { GRAPH_BASE } from "./m365-auth";
import { isFolderInScope } from "./scope";
import type { GraphMailMessage } from "./graph-types";

export { isFolderInScope };
export type { GraphMailMessage } from "./graph-types";
export { extractHeader } from "./graph-types";

export type GraphMailFolder = {
  id: string;
  displayName: string;
  parentFolderId?: string | null;
};

export type GraphMessagesPage = {
  value: GraphMailMessage[];
  "@odata.nextLink"?: string;
  "@odata.deltaLink"?: string;
};

function mailboxUserPath(mailboxAddress: string): string {
  return mailboxAddress === "me"
    ? "me"
    : `users/${encodeURIComponent(mailboxAddress)}`;
}

export async function listMailFolders(args: {
  accessToken: string;
  mailboxAddress: string;
}): Promise<GraphMailFolder[]> {
  const userPath = mailboxUserPath(args.mailboxAddress);
  const res = await fetch(
    `${GRAPH_BASE}/${userPath}/mailFolders?$top=100&$select=id,displayName,parentFolderId`,
    { headers: { Authorization: `Bearer ${args.accessToken}` } }
  );
  if (!res.ok) {
    throw new Error(`Graph list folders failed: ${res.status}`);
  }
  const data = (await res.json()) as { value?: GraphMailFolder[] };
  return data.value ?? [];
}

export async function fetchMessagesPage(args: {
  accessToken: string;
  mailboxAddress: string;
  folderId: string;
  backfillFrom?: Date | null;
  nextLink?: string | null;
  pageSize?: number;
}): Promise<GraphMessagesPage> {
  if (args.nextLink) {
    const res = await fetch(args.nextLink, {
      headers: { Authorization: `Bearer ${args.accessToken}` },
    });
    if (!res.ok) throw new Error(`Graph messages page failed: ${res.status}`);
    return (await res.json()) as GraphMessagesPage;
  }

  const userPath = mailboxUserPath(args.mailboxAddress);
  const params = new URLSearchParams({
    $top: String(args.pageSize ?? 50),
    $select: [
      "id",
      "conversationId",
      "internetMessageId",
      "subject",
      "bodyPreview",
      "body",
      "from",
      "toRecipients",
      "ccRecipients",
      "sentDateTime",
      "receivedDateTime",
      "hasAttachments",
      "internetMessageHeaders",
    ].join(","),
    $orderby: "receivedDateTime asc",
  });

  if (args.backfillFrom) {
    params.set(
      "$filter",
      `receivedDateTime ge ${args.backfillFrom.toISOString()}`
    );
  }

  const url = `${GRAPH_BASE}/${userPath}/mailFolders/${encodeURIComponent(args.folderId)}/messages?${params}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${args.accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`Graph list messages failed: ${res.status}`);
  }
  return (await res.json()) as GraphMessagesPage;
}

export async function fetchDeltaPage(args: {
  accessToken: string;
  mailboxAddress: string;
  folderId: string;
  deltaLink?: string | null;
}): Promise<GraphMessagesPage> {
  const userPath = mailboxUserPath(args.mailboxAddress);
  const url =
    args.deltaLink ??
    `${GRAPH_BASE}/${userPath}/mailFolders/${encodeURIComponent(args.folderId)}/messages/delta?$select=id,conversationId,internetMessageId,subject,bodyPreview,body,from,toRecipients,ccRecipients,sentDateTime,receivedDateTime,hasAttachments,internetMessageHeaders`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${args.accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`Graph delta sync failed: ${res.status}`);
  }
  return (await res.json()) as GraphMessagesPage;
}

export async function fetchMessageMime(args: {
  accessToken: string;
  mailboxAddress: string;
  messageId: string;
}): Promise<string> {
  const userPath = mailboxUserPath(args.mailboxAddress);
  const res = await fetch(
    `${GRAPH_BASE}/${userPath}/messages/${encodeURIComponent(args.messageId)}/$value`,
    { headers: { Authorization: `Bearer ${args.accessToken}` } }
  );
  if (!res.ok) {
    throw new Error(`Graph fetch MIME failed: ${res.status}`);
  }
  return res.text();
}

export async function fetchAttachmentContent(args: {
  accessToken: string;
  mailboxAddress: string;
  messageId: string;
  attachmentId: string;
}): Promise<Buffer> {
  const userPath = mailboxUserPath(args.mailboxAddress);
  const res = await fetch(
    `${GRAPH_BASE}/${userPath}/messages/${encodeURIComponent(args.messageId)}/attachments/${encodeURIComponent(args.attachmentId)}/$value`,
    { headers: { Authorization: `Bearer ${args.accessToken}` } }
  );
  if (!res.ok) {
    throw new Error(`Graph fetch attachment failed: ${res.status}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  return buf;
}

export async function listMessageAttachments(args: {
  accessToken: string;
  mailboxAddress: string;
  messageId: string;
}): Promise<
  Array<{
    id: string;
    name: string;
    contentType: string;
    size: number;
  }>
> {
  const userPath = mailboxUserPath(args.mailboxAddress);
  const res = await fetch(
    `${GRAPH_BASE}/${userPath}/messages/${encodeURIComponent(args.messageId)}/attachments?$select=id,name,contentType,size`,
    { headers: { Authorization: `Bearer ${args.accessToken}` } }
  );
  if (!res.ok) return [];
  const data = (await res.json()) as {
    value?: Array<{
      id: string;
      name?: string;
      contentType?: string;
      size?: number;
    }>;
  };
  return (data.value ?? []).map((a) => ({
    id: a.id,
    name: a.name ?? "attachment",
    contentType: a.contentType ?? "application/octet-stream",
    size: a.size ?? 0,
  }));
}

export function normalizeAddress(addr: string | undefined | null): string {
  return (addr ?? "").trim().toLowerCase();
}

export function collectParticipantAddresses(
  message: GraphMailMessage
): string[] {
  const addrs = new Set<string>();
  const from = normalizeAddress(message.from?.emailAddress?.address);
  if (from) addrs.add(from);
  for (const r of message.toRecipients ?? []) {
    const a = normalizeAddress(r.emailAddress?.address);
    if (a) addrs.add(a);
  }
  for (const r of message.ccRecipients ?? []) {
    const a = normalizeAddress(r.emailAddress?.address);
    if (a) addrs.add(a);
  }
  return [...addrs];
}
