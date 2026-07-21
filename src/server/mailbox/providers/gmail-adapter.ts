/**
 * Gmail mailbox adapter — implements MailProviderAdapter via gmail-auth +
 * gmail-client. Delegated-only, so mailboxAddress is not used for API paths
 * (Gmail uses the "me" userId of the authorized token). The Gmail history-based
 * delta cursor is encapsulated inside the canonical deltaLink field.
 */

import { getConnectionAccessToken } from "../gmail-auth";
import {
  listGmailLabels,
  fetchGmailMessagesPage,
  fetchGmailDeltaPage,
  fetchGmailMessageMime,
  listGmailMessageAttachments,
  fetchGmailAttachmentContent,
} from "../gmail-client";
import type {
  MailProviderAdapter,
  MailMessagesPage,
  MailFolder,
  MailAttachmentMeta,
} from "./types";

export const gmailAdapter: MailProviderAdapter = {
  channel: "EMAIL_GMAIL",

  getAccessToken(args) {
    return getConnectionAccessToken(args);
  },

  listFolders(args): Promise<MailFolder[]> {
    return listGmailLabels({ accessToken: args.accessToken });
  },

  fetchMessagesPage(args): Promise<MailMessagesPage> {
    return fetchGmailMessagesPage({
      accessToken: args.accessToken,
      folderId: args.folderId,
      backfillFrom: args.backfillFrom,
      nextLink: args.nextLink,
      pageSize: args.pageSize,
    });
  },

  fetchDeltaPage(args): Promise<MailMessagesPage> {
    return fetchGmailDeltaPage({
      accessToken: args.accessToken,
      folderId: args.folderId,
      deltaLink: args.deltaLink,
    });
  },

  fetchMessageMime(args): Promise<string> {
    return fetchGmailMessageMime({
      accessToken: args.accessToken,
      messageId: args.messageId,
    });
  },

  listMessageAttachments(args): Promise<MailAttachmentMeta[]> {
    return listGmailMessageAttachments({
      accessToken: args.accessToken,
      messageId: args.messageId,
    });
  },

  fetchAttachmentContent(args): Promise<Buffer> {
    return fetchGmailAttachmentContent({
      accessToken: args.accessToken,
      messageId: args.messageId,
      attachmentId: args.attachmentId,
    });
  },
};
