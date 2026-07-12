/**
 * Redaction guard — single choke point before any third-party LLM call.
 * Epic B CV-B-09
 */

import { createHash } from "node:crypto";

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const PHONE_RE = /\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g;
const SSN_RE = /\b\d{3}-\d{2}-\d{4}\b/g;
const DOLLAR_RE = /\$\s?\d{1,3}(?:,\d{3})*(?:\.\d{2})?/g;
const ACCOUNT_RE = /\b(?:acct|account)\s*#?\s*\d{4,}\b/gi;

let llmCallAllowed = false;

export type RedactedContent = {
  text: string;
  contentHash: string;
  redactionCount: number;
};

export function redactForLlm(input: {
  bodyText: string;
  fromAddress?: string;
  toAddresses?: string[];
}): RedactedContent {
  let text = input.bodyText;
  let redactionCount = 0;

  const apply = (re: RegExp, replacement: string): void => {
    const before = text;
    text = text.replace(re, replacement);
    if (text !== before) redactionCount += 1;
  };

  apply(EMAIL_RE, "[EMAIL]");
  apply(PHONE_RE, "[PHONE]");
  apply(SSN_RE, "[SSN]");
  apply(DOLLAR_RE, "[AMOUNT]");
  apply(ACCOUNT_RE, "[ACCOUNT]");

  if (input.fromAddress) {
    text = text.replaceAll(input.fromAddress, "[SENDER]");
  }
  for (const addr of input.toAddresses ?? []) {
    text = text.replaceAll(addr, "[RECIPIENT]");
  }

  const contentHash = createHash("sha256").update(text).digest("hex");
  return { text, contentHash, redactionCount };
}

/**
 * All outbound LLM calls MUST use this wrapper.
 */
export async function callLlmWithRedaction<T>(args: {
  bodyText: string;
  fromAddress?: string;
  toAddresses?: string[];
  invoke: (redactedText: string) => Promise<T>;
}): Promise<T> {
  const redacted = redactForLlm({
    bodyText: args.bodyText,
    fromAddress: args.fromAddress,
    toAddresses: args.toAddresses,
  });
  llmCallAllowed = true;
  try {
    return await args.invoke(redacted.text);
  } finally {
    llmCallAllowed = false;
  }
}

/** Throws if code attempts a direct LLM call without redaction guard */
export function assertRedactionGuardUsed(): void {
  if (!llmCallAllowed) {
    throw new Error("LLM calls must go through callLlmWithRedaction");
  }
}

export function resetRedactionGuardForTests(): void {
  llmCallAllowed = false;
}
