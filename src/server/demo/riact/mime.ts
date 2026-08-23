/**
 * RFC822 MIME builder for RIACT demo seed — hashes computed from MIME bytes.
 */

import { createHash } from "node:crypto";

export type BuildMimeArgs = {
  from: string;
  to: string[];
  subject: string;
  bodyText: string;
  messageId: string;
  date: Date;
  inReplyTo?: string;
};

export type MimeBuildResult = {
  mime: string;
  contentSha256: string;
  internetMessageId: string;
};

export function buildRfc822Mime(args: BuildMimeArgs): MimeBuildResult {
  const internetMessageId = `<${args.messageId}@riact.demo.example.com>`;
  const dateRfc = args.date.toUTCString();
  const toHeader = args.to.join(", ");
  const inReply =
    args.inReplyTo !== undefined
      ? `In-Reply-To: <${args.inReplyTo}@riact.demo.example.com>\r\n`
      : "";

  const mime = [
    `From: ${args.from}`,
    `To: ${toHeader}`,
    `Subject: ${args.subject}`,
    `Date: ${dateRfc}`,
    `Message-ID: ${internetMessageId}`,
    inReply,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=utf-8",
    "Content-Transfer-Encoding: 8bit",
    "",
    args.bodyText,
    "",
  ]
    .filter((line, i, arr) => !(line === "" && i === arr.length - 1))
    .join("\r\n");

  const contentSha256 = createHash("sha256").update(mime, "utf8").digest("hex");
  return { mime, contentSha256, internetMessageId };
}

export function emailSearchable(subject: string, body: string): string {
  return `${subject} ${body}`.replace(/\s+/g, " ").trim().toLowerCase();
}

export function mailboxStorageKey(
  workspaceId: string,
  connectionId: string,
  messageId: string,
): string {
  return `workspaces/${workspaceId}/mailbox/${connectionId}/${messageId}/message.eml`;
}
