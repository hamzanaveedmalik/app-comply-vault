/**
 * Inbound document-request letter for exam-response demo (Moment A).
 * Prefer the seeded RIACT SEC letter when present in the workspace.
 */

import "server-only";

import { db } from "~/server/db";
import {
  RIACT_SEC_DOCUMENT_REQUEST,
  isRiactWorkspaceId,
} from "~/server/demo/riact/tenant";

export type InboundDocumentRequestDto = {
  id: string;
  title: string;
  body: string;
  /** Single request item for Candidate Pack paste/interpret. */
  requestItemText: string;
  occurredAt: string;
  contentSha256: string;
  arrivedLabel: string;
};

function bodyFromSearchable(title: string, searchableText: string | null): string {
  if (!searchableText) return "";
  const trimmed = searchableText.trim();
  if (trimmed.startsWith(title)) {
    return trimmed.slice(title.length).replace(/^\n+/, "").trim();
  }
  return trimmed;
}

function arrivedLabel(occurredAt: Date): string {
  return occurredAt.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export async function getInboundDocumentRequest(
  workspaceId: string,
): Promise<InboundDocumentRequestDto | null> {
  const preferred = await db.evidenceItem.findFirst({
    where: {
      workspaceId,
      id: RIACT_SEC_DOCUMENT_REQUEST.id,
      sourceType: "DOCUMENT",
      deletedAt: null,
    },
  });

  const item =
    preferred ??
    (await db.evidenceItem.findFirst({
      where: {
        workspaceId,
        sourceType: "DOCUMENT",
        deletedAt: null,
      },
      orderBy: { occurredAt: "desc" },
    }));

  if (!item) return null;

  const isRiactLetter = item.id === RIACT_SEC_DOCUMENT_REQUEST.id;
  const body = isRiactLetter
    ? RIACT_SEC_DOCUMENT_REQUEST.body
    : bodyFromSearchable(item.title, item.searchableText);

  return {
    id: item.id,
    title: item.title,
    body,
    requestItemText: isRiactLetter
      ? RIACT_SEC_DOCUMENT_REQUEST.requestItemText
      : item.title,
    occurredAt: item.occurredAt.toISOString(),
    contentSha256: item.contentSha256,
    arrivedLabel: arrivedLabel(item.occurredAt),
  };
}

export function documentRequestDemoReady(workspaceId: string): boolean {
  return isRiactWorkspaceId(workspaceId);
}
