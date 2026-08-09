/**
 * Demo bridge: promote an ingested email into an "Email"-typed Meeting.
 *
 * Scope: gated behind isEmailToMeetingEnabled() (Release 1 demo or explicit
 * EMAIL_TO_MEETING_ENABLED). Turns a single ingested email into a Meeting so
 * it flows through the dashboard, interaction log and supervision review queue
 * — while staying distinguished from recorded meetings via meetingType = "Email".
 *
 * ⚠️ COMPLIANCE IMPACT: creates Meeting + Flag records and writes audit events.
 * Client attribution auto-creates / links a Client for the external counterparty.
 * When the sender is a workspace member (presenter simulating a client), the
 * demo maps them to "Jane Client" so the narrative stays clean.
 */

import { db } from "~/server/db";
import { normalizeParticipantAddress, upsertVerifiedAlias } from "./participant-matching";
import { detectMissingDisclosureFlags } from "~/server/flags";
import { getDisclosureProfileForWorkspace } from "~/server/firm-profile/get-disclosure-profile-for-workspace";
import { emailFlagDedupeKey } from "~/server/classification/email-taxonomy";
import { isEmailToMeetingEnabled, isRelease1DemoEnabled } from "~/lib/feature-flags";
import {
  EMAIL_MEETING_TYPE,
  buildExtraction,
  deriveNameFromAddress,
  pickCounterparty,
  scanEmailForFlags,
} from "./email-to-meeting-rules";

export { EMAIL_MEETING_TYPE } from "./email-to-meeting-rules";

/** Demo narrative client when a workspace member sends into the connected mailbox. */
export const DEMO_EMAIL_CLIENT_NAME = "Jane Client";

async function linkAliasToClient(args: {
  workspaceId: string;
  address: string;
  clientId: string;
}): Promise<void> {
  const address = normalizeParticipantAddress(args.address);
  const existingAlias = await db.emailAlias.findFirst({
    where: { workspaceId: args.workspaceId, address, deletedAt: null },
    select: { userId: true },
  });
  const user = await db.user.findFirst({
    where: { email: { equals: address, mode: "insensitive" } },
    select: { id: true },
  });
  await upsertVerifiedAlias({
    workspaceId: args.workspaceId,
    address,
    userId: existingAlias?.userId ?? user?.id ?? null,
    clientId: args.clientId,
  });
}

async function findOrCreateNamedClient(args: {
  workspaceId: string;
  name: string;
  address: string;
  contactAt: Date;
}): Promise<{ clientId: string; clientName: string }> {
  const existing = await db.client.findFirst({
    where: {
      workspaceId: args.workspaceId,
      name: args.name,
      deletedAt: null,
    },
    select: { id: true, name: true },
  });
  if (existing) {
    await linkAliasToClient({
      workspaceId: args.workspaceId,
      address: args.address,
      clientId: existing.id,
    });
    await db.client.update({
      where: { id: existing.id },
      data: { lastContactAt: args.contactAt },
    });
    return { clientId: existing.id, clientName: existing.name };
  }

  const client = await db.client.create({
    data: {
      workspaceId: args.workspaceId,
      name: args.name,
      status: "CLIENT",
      lastContactAt: args.contactAt,
    },
    select: { id: true, name: true },
  });
  await linkAliasToClient({
    workspaceId: args.workspaceId,
    address: args.address,
    clientId: client.id,
  });
  return { clientId: client.id, clientName: client.name };
}

async function isWorkspaceMemberEmail(
  workspaceId: string,
  address: string,
): Promise<boolean> {
  const user = await db.user.findFirst({
    where: { email: { equals: address, mode: "insensitive" } },
    select: { id: true },
  });
  if (!user) return false;
  const membership = await db.userWorkspace.findFirst({
    where: { workspaceId, userId: user.id, removedAt: null },
    select: { userId: true },
  });
  return Boolean(membership);
}

async function findOrCreateClientForAddress(args: {
  workspaceId: string;
  address: string;
  fallbackName: string;
  contactAt: Date;
}): Promise<{ clientId: string; clientName: string }> {
  const address = normalizeParticipantAddress(args.address);

  // Presenter sending into the demo mailbox → always Jane Client.
  if (
    isRelease1DemoEnabled() &&
    (await isWorkspaceMemberEmail(args.workspaceId, address))
  ) {
    return findOrCreateNamedClient({
      workspaceId: args.workspaceId,
      name: DEMO_EMAIL_CLIENT_NAME,
      address,
      contactAt: args.contactAt,
    });
  }

  const alias = await db.emailAlias.findFirst({
    where: {
      workspaceId: args.workspaceId,
      address,
      clientId: { not: null },
      deletedAt: null,
    },
    select: { clientId: true },
  });
  if (alias?.clientId) {
    const existing = await db.client.findFirst({
      where: {
        id: alias.clientId,
        workspaceId: args.workspaceId,
        deletedAt: null,
      },
      select: { id: true, name: true },
    });
    if (existing) {
      await db.client.update({
        where: { id: existing.id },
        data: { lastContactAt: args.contactAt },
      });
      return { clientId: existing.id, clientName: existing.name };
    }
  }

  const name = args.fallbackName || deriveNameFromAddress(address);
  return findOrCreateNamedClient({
    workspaceId: args.workspaceId,
    name,
    address,
    contactAt: args.contactAt,
  });
}

async function resolveActorUserId(workspaceId: string): Promise<string | null> {
  const owner = await db.userWorkspace.findFirst({
    where: { workspaceId, role: "OWNER_CCO", removedAt: null },
    select: { userId: true },
  });
  if (owner) return owner.userId;
  const anyMember = await db.userWorkspace.findFirst({
    where: { workspaceId, removedAt: null },
    select: { userId: true },
  });
  return anyMember?.userId ?? null;
}

export type PromoteEmailToMeetingArgs = {
  workspaceId: string;
  mailboxAddress: string;
  evidenceItemId: string;
  communicationId: string;
  threadId: string;
  contentSha256: string;
  subject: string;
  bodyText: string;
  sentAt: Date;
  fromAddress: string;
  fromName?: string | null;
  toRecipients: Array<{ address: string; name?: string | null }>;
  ccRecipients: Array<{ address: string; name?: string | null }>;
};

export type PromoteEmailToMeetingResult =
  | { status: "created"; meetingId: string; flagCount: number; clientName: string }
  | { status: "skipped"; reason: string };

/**
 * Promote a single ingested email into an Email-typed Meeting with attribution
 * and deterministic + disclosure flags. Never throws — ingest must not fail if
 * the demo bridge does.
 */
export async function promoteEmailToMeeting(
  args: PromoteEmailToMeetingArgs,
): Promise<PromoteEmailToMeetingResult> {
  try {
    const counterparty = pickCounterparty({
      mailboxAddress: args.mailboxAddress,
      fromAddress: args.fromAddress,
      fromName: args.fromName,
      toRecipients: args.toRecipients,
      ccRecipients: args.ccRecipients,
    });
    if (!counterparty) {
      return { status: "skipped", reason: "no_external_counterparty" };
    }

    const { clientId, clientName } = await findOrCreateClientForAddress({
      workspaceId: args.workspaceId,
      address: counterparty.address,
      fallbackName: counterparty.name,
      contactAt: args.sentAt,
    });

    const extraction = buildExtraction(args.subject, args.bodyText);
    const participantEmails = [
      normalizeParticipantAddress(args.fromAddress),
      ...args.toRecipients.map((r) => normalizeParticipantAddress(r.address)),
      ...args.ccRecipients.map((r) => normalizeParticipantAddress(r.address)),
    ].filter((a, i, arr) => a && arr.indexOf(a) === i);

    const transcript = {
      segments: [
        {
          startTime: 0,
          endTime: 0,
          speaker: clientName,
          text: `${args.subject}\n\n${args.bodyText}`.trim(),
        },
      ],
    };

    const searchableText = [clientName, args.subject, args.bodyText]
      .join(" ")
      .toLowerCase()
      .slice(0, 50_000);

    const keywordFlags = scanEmailForFlags(args.subject, args.bodyText);
    const profile = await getDisclosureProfileForWorkspace(args.workspaceId);
    const disclosureFlags = detectMissingDisclosureFlags(extraction, { profile });
    const actorUserId = await resolveActorUserId(args.workspaceId);

    const meeting = await db.$transaction(async (tx) => {
      const created = await tx.meeting.create({
        data: {
          workspaceId: args.workspaceId,
          clientName,
          clientId,
          clientMatchConfidence: "EMAIL",
          participantEmails,
          meetingType: EMAIL_MEETING_TYPE,
          meetingDate: args.sentAt,
          status: "DRAFT_READY",
          draftReadyAt: new Date(),
          transcript: transcript as unknown as object,
          extraction: extraction as unknown as object,
          searchableText,
          sourceFileName: `email:${args.subject}`.slice(0, 240),
          sourceFileMime: "message/rfc822",
          sourceUploadedAt: new Date(),
        },
        select: { id: true },
      });

      // Attribute the evidence item so Communications / Ask also show the client.
      await tx.evidenceItem.update({
        where: { id: args.evidenceItemId },
        data: { clientId },
      });

      // Attach any existing LLM / keyword EMAIL flags for this message to the meeting.
      await tx.flag.updateMany({
        where: {
          workspaceId: args.workspaceId,
          communicationId: args.communicationId,
          meetingId: null,
        },
        data: { meetingId: created.id },
      });

      for (const flag of keywordFlags) {
        const dedupeKey = emailFlagDedupeKey(args.communicationId, flag.type);
        const existing = await tx.flag.findFirst({
          where: { workspaceId: args.workspaceId, dedupeKey },
          select: { id: true },
        });
        if (existing) {
          await tx.flag.update({
            where: { id: existing.id },
            data: { meetingId: created.id },
          });
          continue;
        }
        await tx.flag.create({
          data: {
            workspaceId: args.workspaceId,
            meetingId: created.id,
            sourceType: "EMAIL",
            sourceId: args.threadId,
            communicationId: args.communicationId,
            dedupeKey,
            type: flag.type,
            severity: flag.severity,
            status: "OPEN",
            createdByType: "SYSTEM",
            evidence: {
              excerpt: flag.excerpt,
              rationale: flag.rationale,
              matchedPhrase: flag.matchedPhrase,
              confidence: 0.9,
              source: "email_keyword",
              communicationId: args.communicationId,
              threadId: args.threadId,
              evidenceItemId: args.evidenceItemId,
              contentSha256: args.contentSha256,
              clientId,
              clientName,
            },
          },
        });
      }

      if (disclosureFlags.length > 0) {
        await tx.flag.createMany({
          data: disclosureFlags.map((flag) => ({
            workspaceId: args.workspaceId,
            meetingId: created.id,
            sourceType: "MEETING" as const,
            sourceId: created.id,
            type: flag.type,
            severity: flag.severity,
            status: "OPEN" as const,
            evidence: flag.evidence as unknown as object,
            createdByType: "SYSTEM" as const,
          })),
        });
      }

      if (actorUserId) {
        await tx.auditEvent.create({
          data: {
            workspaceId: args.workspaceId,
            userId: actorUserId,
            action: "UPLOAD",
            resourceType: "meeting",
            resourceId: created.id,
            meetingId: created.id,
            metadata: {
              action: "email_promoted_to_meeting",
              communicationId: args.communicationId,
              evidenceItemId: args.evidenceItemId,
              threadId: args.threadId,
              clientId,
              clientName,
              keywordFlagCount: keywordFlags.length,
              disclosureFlagCount: disclosureFlags.length,
            },
          },
        });
      }

      return created;
    });

    return {
      status: "created",
      meetingId: meeting.id,
      flagCount: keywordFlags.length + disclosureFlags.length,
      clientName,
    };
  } catch (err) {
    console.error("promoteEmailToMeeting failed (ingest continues)", {
      evidenceItemId: args.evidenceItemId,
      reason: err instanceof Error ? err.message : "unknown",
    });
    return { status: "skipped", reason: "error" };
  }
}

/**
 * Promote EMAIL evidence that was ingested before the bridge was enabled
 * (or skipped). Safe to call after Delta sync — idempotent via audit metadata.
 */
export async function promotePendingEmailsInWorkspace(
  workspaceId: string,
  mailboxAddress: string,
): Promise<{ promoted: number; skipped: number }> {
  if (!isEmailToMeetingEnabled()) {
    return { promoted: 0, skipped: 0 };
  }

  const items = await db.evidenceItem.findMany({
    where: {
      workspaceId,
      sourceType: "EMAIL",
      deletedAt: null,
    },
    include: {
      communication: {
        select: {
          id: true,
          threadId: true,
          fromAddress: true,
          toAddresses: true,
          ccAddresses: true,
          bodyText: true,
          sentAt: true,
        },
      },
    },
    orderBy: { occurredAt: "desc" },
    take: 40,
  });

  let promoted = 0;
  let skipped = 0;

  for (const item of items) {
    const comm = item.communication;
    if (!comm) {
      skipped += 1;
      continue;
    }

    // Already promoted if any flag on this communication is linked to a meeting,
    // or an Email-type meeting was created for this evidence (audit metadata).
    const linkedFlag = await db.flag.findFirst({
      where: {
        workspaceId,
        communicationId: comm.id,
        meetingId: { not: null },
      },
      select: { id: true },
    });
    if (linkedFlag) {
      // Still ensure EvidenceItem.clientId is set when a meeting exists.
      if (!item.clientId) {
        const meeting = await db.meeting.findFirst({
          where: {
            workspaceId,
            meetingType: EMAIL_MEETING_TYPE,
            flags: { some: { communicationId: comm.id } },
          },
          select: { clientId: true, clientName: true },
        });
        if (meeting?.clientId) {
          await db.evidenceItem.update({
            where: { id: item.id },
            data: { clientId: meeting.clientId },
          });
        }
      }
      skipped += 1;
      continue;
    }

    const result = await promoteEmailToMeeting({
      workspaceId,
      mailboxAddress,
      evidenceItemId: item.id,
      communicationId: comm.id,
      threadId: comm.threadId,
      contentSha256: item.contentSha256,
      subject: item.title,
      bodyText: comm.bodyText ?? "",
      sentAt: comm.sentAt,
      fromAddress: comm.fromAddress,
      fromName: null,
      toRecipients: comm.toAddresses.map((a) => ({ address: a, name: null })),
      ccRecipients: comm.ccAddresses.map((a) => ({ address: a, name: null })),
    });

    if (result.status === "created") promoted += 1;
    else skipped += 1;
  }

  return { promoted, skipped };
}
