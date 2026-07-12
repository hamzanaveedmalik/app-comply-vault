/**
 * Graph mail types + header helpers (no DB/Auth imports).
 */

export type GraphMailMessage = {
  id: string;
  conversationId?: string | null;
  internetMessageId?: string | null;
  subject?: string | null;
  bodyPreview?: string | null;
  body?: { contentType?: string; content?: string };
  from?: { emailAddress?: { address?: string; name?: string } };
  toRecipients?: Array<{ emailAddress?: { address?: string; name?: string } }>;
  ccRecipients?: Array<{ emailAddress?: { address?: string; name?: string } }>;
  sentDateTime?: string | null;
  receivedDateTime?: string | null;
  hasAttachments?: boolean;
  internetMessageHeaders?: Array<{ name?: string; value?: string }>;
};

export function extractHeader(
  message: GraphMailMessage,
  name: string
): string | null {
  const headers = message.internetMessageHeaders ?? [];
  const found = headers.find(
    (h) => h.name?.toLowerCase() === name.toLowerCase()
  );
  return found?.value ?? null;
}
