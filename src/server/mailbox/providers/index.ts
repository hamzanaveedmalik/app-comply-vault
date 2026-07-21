/**
 * Mailbox provider registry — resolves the adapter for a MailboxConnection.
 */

import type { MailboxProvider } from "../../../../generated/prisma";
import type { MailProviderAdapter } from "./types";
import { m365Adapter } from "./m365-adapter";
import { gmailAdapter } from "./gmail-adapter";

export type {
  MailProviderAdapter,
  MailMessage,
  MailFolder,
  MailMessagesPage,
  MailAttachmentMeta,
} from "./types";

export function getMailProvider(provider: MailboxProvider): MailProviderAdapter {
  switch (provider) {
    case "M365":
      return m365Adapter;
    case "GMAIL":
      return gmailAdapter;
    default: {
      const _exhaustive: never = provider;
      throw new Error(`Unsupported mailbox provider: ${String(_exhaustive)}`);
    }
  }
}
