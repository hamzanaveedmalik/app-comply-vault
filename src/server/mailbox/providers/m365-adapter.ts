/**
 * M365 (Microsoft Graph) mailbox adapter — wraps the existing graph-client +
 * m365-auth modules with no behavior change, mapping Graph's @odata cursors
 * onto the canonical MailMessagesPage shape.
 */

import { getConnectionAccessToken } from "../m365-auth";
import {
  listMailFolders,
  fetchMessagesPage as graphFetchMessagesPage,
  fetchDeltaPage as graphFetchDeltaPage,
  fetchMessageMime as graphFetchMessageMime,
  listMessageAttachments as graphListMessageAttachments,
  fetchAttachmentContent as graphFetchAttachmentContent,
} from "../graph-client";
import type {
  MailProviderAdapter,
  MailMessagesPage,
  MailFolder,
  MailAttachmentMeta,
} from "./types";

export const m365Adapter: MailProviderAdapter = {
  channel: "EMAIL_M365",

  getAccessToken(args) {
    return getConnectionAccessToken(args);
  },

  async listFolders(args): Promise<MailFolder[]> {
    const folders = await listMailFolders(args);
    return folders.map((f) => ({
      id: f.id,
      displayName: f.displayName,
      parentFolderId: f.parentFolderId ?? null,
    }));
  },

  async fetchMessagesPage(args): Promise<MailMessagesPage> {
    const page = await graphFetchMessagesPage(args);
    return {
      value: page.value,
      nextLink: page["@odata.nextLink"] ?? null,
      deltaLink: page["@odata.deltaLink"] ?? null,
    };
  },

  async fetchDeltaPage(args): Promise<MailMessagesPage> {
    const page = await graphFetchDeltaPage(args);
    return {
      value: page.value,
      nextLink: page["@odata.nextLink"] ?? null,
      deltaLink: page["@odata.deltaLink"] ?? null,
    };
  },

  fetchMessageMime(args): Promise<string> {
    return graphFetchMessageMime(args);
  },

  listMessageAttachments(args): Promise<MailAttachmentMeta[]> {
    return graphListMessageAttachments(args);
  },

  fetchAttachmentContent(args): Promise<Buffer> {
    return graphFetchAttachmentContent(args);
  },
};
