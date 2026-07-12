/**
 * Persist a single Graph message as EvidenceItem + Communication.
 * Epic B CV-B-03, CV-B-05
 */

import { db } from "~/server/db";
import type { GraphMailMessage } from "./graph-client";
import {
  collectParticipantAddresses,
  extractHeader,
  listMessageAttachments,
  fetchAttachmentContent,
  fetchMessageMime,
  normalizeAddress,
} from "./graph-client";
import { threadKeyFromMessage } from "./thread-grouping";
import {
  matchParticipantAddress,
  type ParticipantMatch,
} from "./participant-matching";
import { uploadMailboxContent } from "./storage";
import { enqueueClassification } from "~/server/classification/enqueue";
import { sha256FromBuffer } from "~/server/hash";

export type IngestMessageResult =
  | { status: "created"; evidenceItemId: string }
  | { status: "duplicate" }
  | { status: "error"; reason: string };

function inferDirection(
  fromAddress: string,
  mailboxAddress: string
): "INBOUND" | "OUTBOUND" | "INTERNAL" {
  const from = normalizeAddress(fromAddress);
  const mailbox = normalizeAddress(mailboxAddress);
  if (from === mailbox) return "OUTBOUND";
  if (from.endsWith(mailbox.split("@")[1] ?? "")) return "INTERNAL";
  return "INBOUND";
}

export async function ingestGraphMessage(args: {
  workspaceId: string;
  connectionId: string;
  mailboxAddress: string;
  accessToken: string;
  message: GraphMailMessage;
  allowedFolderIds: string[];
  currentFolderId: string;
}): Promise<IngestMessageResult> {
  if (!args.allowedFolderIds.includes(args.currentFolderId)) {
    return { status: "error", reason: "folder_out_of_scope" };
  }

  const internetMessageId = args.message.internetMessageId?.trim() || null;
  if (internetMessageId) {
    const existing = await db.communication.findUnique({
      where: { internetMessageId },
      select: { id: true },
    });
    if (existing) return { status: "duplicate" };
  }

  try {
    const fromAddress =
      normalizeAddress(args.message.from?.emailAddress?.address) || "unknown";
    const toAddresses = (args.message.toRecipients ?? [])
      .map((r) => normalizeAddress(r.emailAddress?.address))
      .filter(Boolean);
    const ccAddresses = (args.message.ccRecipients ?? [])
      .map((r) => normalizeAddress(r.emailAddress?.address))
      .filter(Boolean);

    const sentAt = new Date(
      args.message.sentDateTime ??
        args.message.receivedDateTime ??
        new Date().toISOString()
    );

    const bodyHtml =
      args.message.body?.contentType === "html"
        ? args.message.body.content ?? null
        : null;
    const bodyText =
      args.message.body?.contentType === "text"
        ? args.message.body.content ?? args.message.bodyPreview ?? ""
        : args.message.bodyPreview ?? "";

    const mime = await fetchMessageMime({
      accessToken: args.accessToken,
      mailboxAddress: args.mailboxAddress,
      messageId: args.message.id,
    });
    const mimeBuffer = Buffer.from(mime, "utf8");
    const { storageUri, contentSha256 } = await uploadMailboxContent({
      workspaceId: args.workspaceId,
      connectionId: args.connectionId,
      messageId: args.message.id,
      filename: "message.eml",
      content: mimeBuffer,
      contentType: "message/rfc822",
    });

    const participantAddresses = collectParticipantAddresses(args.message);
    const participantMatches: ParticipantMatch[] = [];
    for (const addr of participantAddresses) {
      participantMatches.push(
        await matchParticipantAddress({
          workspaceId: args.workspaceId,
          address: addr,
        })
      );
    }

    const clientId =
      participantMatches.find((p) => p.clientId)?.clientId ?? null;

    const externalThreadId = threadKeyFromMessage(args.message);
    const subject = args.message.subject ?? "(no subject)";

    const result = await db.$transaction(async (tx) => {
      let thread = await tx.communicationThread.findFirst({
        where: {
          workspaceId: args.workspaceId,
          externalThreadId,
          deletedAt: null,
        },
      });

      if (!thread) {
        thread = await tx.communicationThread.create({
          data: {
            workspaceId: args.workspaceId,
            channel: "EMAIL_M365",
            externalThreadId,
            subject,
            participants: participantMatches.map((p) => ({
              address: p.address,
              userId: p.userId,
              clientId: p.clientId,
              verified: p.verified,
            })),
          },
        });
      } else {
        await tx.communicationThread.update({
          where: { id: thread.id },
          data: {
            subject: thread.subject ?? subject,
            participants: participantMatches.map((p) => ({
              address: p.address,
              userId: p.userId,
              clientId: p.clientId,
              verified: p.verified,
            })),
            updatedAt: new Date(),
          },
        });
      }

      const evidenceItem = await tx.evidenceItem.create({
        data: {
          workspaceId: args.workspaceId,
          clientId,
          sourceType: "EMAIL",
          title: subject,
          occurredAt: sentAt,
          contentSha256,
          storageUri,
        },
      });

      const communication = await tx.communication.create({
        data: {
          threadId: thread.id,
          evidenceItemId: evidenceItem.id,
          direction: inferDirection(fromAddress, args.mailboxAddress),
          sentAt,
          fromAddress,
          toAddresses,
          ccAddresses,
          internetMessageId,
          bodyText,
          bodyHtml,
          inReplyTo: extractHeader(args.message, "In-Reply-To"),
          referencesHeader: extractHeader(args.message, "References"),
        },
      });

      if (args.message.hasAttachments) {
        const attachments = await listMessageAttachments({
          accessToken: args.accessToken,
          mailboxAddress: args.mailboxAddress,
          messageId: args.message.id,
        });

        for (const att of attachments) {
          const content = await fetchAttachmentContent({
            accessToken: args.accessToken,
            mailboxAddress: args.mailboxAddress,
            messageId: args.message.id,
            attachmentId: att.id,
          });
          const uploaded = await uploadMailboxContent({
            workspaceId: args.workspaceId,
            connectionId: args.connectionId,
            messageId: args.message.id,
            filename: att.name,
            content,
            contentType: att.contentType,
          });
          await tx.attachment.create({
            data: {
              communicationId: communication.id,
              filename: att.name,
              mimeType: att.contentType,
              contentSha256: uploaded.contentSha256,
              storageUri: uploaded.storageUri,
              sizeBytes: att.size,
            },
          });
        }
      }

      return evidenceItem.id;
    });

    await enqueueClassification({
      workspaceId: args.workspaceId,
      evidenceItemId: result,
    });

    return { status: "created", evidenceItemId: result };
  } catch (err) {
    const reason = err instanceof Error ? err.message : "unknown_error";
    return { status: "error", reason };
  }
}

export function hashBodyPreview(text: string): string {
  return sha256FromBuffer(Buffer.from(text, "utf8"));
}
