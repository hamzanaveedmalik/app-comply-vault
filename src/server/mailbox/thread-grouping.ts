/**
 * Email thread grouping — conversationId primary, References/In-Reply-To fallback.
 * Epic B CV-B-05
 */

import type { GraphMailMessage } from "./graph-types";
import { extractHeader } from "./graph-types";

export type ThreadGroupingInput = {
  conversationId?: string | null;
  internetMessageId?: string | null;
  inReplyTo?: string | null;
  referencesHeader?: string | null;
  subject?: string | null;
};

export function threadKeyFromMessage(message: GraphMailMessage): string {
  return threadKeyFromParts({
    conversationId: message.conversationId,
    internetMessageId: message.internetMessageId,
    inReplyTo: extractHeader(message, "In-Reply-To"),
    referencesHeader: extractHeader(message, "References"),
    subject: message.subject,
  });
}

export function threadKeyFromParts(input: ThreadGroupingInput): string {
  if (input.conversationId) {
    return `conv:${input.conversationId}`;
  }

  const refs = parseReferences(input.referencesHeader);
  const inReplyTo = normalizeMessageId(input.inReplyTo);
  const root =
    refs[0] ?? inReplyTo ?? normalizeMessageId(input.internetMessageId);
  if (root) {
    return `ref:${root}`;
  }

  const subject = normalizeSubject(input.subject);
  return `subj:${subject || "no-subject"}`;
}

export function parseReferences(header: string | null | undefined): string[] {
  if (!header) return [];
  return header
    .split(/\s+/)
    .map(normalizeMessageId)
    .filter((id): id is string => Boolean(id));
}

export function normalizeMessageId(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim().replace(/^<|>$/g, "");
  return trimmed || null;
}

export function normalizeSubject(subject: string | null | undefined): string {
  if (!subject) return "";
  let s = subject.trim();
  while (/^(re|fw|fwd):\s*/i.test(s)) {
    s = s.replace(/^(re|fw|fwd):\s*/i, "").trim();
  }
  return s.toLowerCase();
}

export function shouldMergeThreads(a: ThreadGroupingInput, b: ThreadGroupingInput): boolean {
  return threadKeyFromParts(a) === threadKeyFromParts(b);
}
