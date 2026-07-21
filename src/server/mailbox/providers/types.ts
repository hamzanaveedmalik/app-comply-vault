/**
 * Provider-agnostic mailbox adapter interface.
 *
 * The shared ingestion pipeline (ingest.ts, ingest-message.ts, folders route)
 * talks only to this interface; concrete adapters (M365, Gmail) translate to
 * their respective provider APIs. The canonical message shape is the existing
 * GraphMailMessage (already provider-neutral RFC822-style fields).
 */

import type { CommunicationChannel } from "../../../../generated/prisma";
import type { GraphMailMessage } from "../graph-types";

export type MailMessage = GraphMailMessage;

export type MailFolder = {
  id: string;
  displayName: string;
  parentFolderId?: string | null;
};

/**
 * Canonical page of messages. Adapters map provider-specific cursors
 * (Graph @odata.nextLink/@odata.deltaLink, Gmail pageToken/historyId) onto
 * these two neutral fields so the ingest loop stays provider-agnostic.
 */
export type MailMessagesPage = {
  value: MailMessage[];
  nextLink?: string | null;
  deltaLink?: string | null;
};

export type MailAttachmentMeta = {
  id: string;
  name: string;
  contentType: string;
  size: number;
};

export interface MailProviderAdapter {
  /** CommunicationThread.channel value written for messages from this provider. */
  readonly channel: CommunicationChannel;

  getAccessToken(args: {
    workspaceId: string;
    connectionId: string;
  }): Promise<string>;

  listFolders(args: {
    accessToken: string;
    mailboxAddress: string;
  }): Promise<MailFolder[]>;

  fetchMessagesPage(args: {
    accessToken: string;
    mailboxAddress: string;
    folderId: string;
    backfillFrom?: Date | null;
    nextLink?: string | null;
    pageSize?: number;
  }): Promise<MailMessagesPage>;

  fetchDeltaPage(args: {
    accessToken: string;
    mailboxAddress: string;
    folderId: string;
    deltaLink?: string | null;
  }): Promise<MailMessagesPage>;

  fetchMessageMime(args: {
    accessToken: string;
    mailboxAddress: string;
    messageId: string;
  }): Promise<string>;

  listMessageAttachments(args: {
    accessToken: string;
    mailboxAddress: string;
    messageId: string;
  }): Promise<MailAttachmentMeta[]>;

  fetchAttachmentContent(args: {
    accessToken: string;
    mailboxAddress: string;
    messageId: string;
    attachmentId: string;
  }): Promise<Buffer>;
}
