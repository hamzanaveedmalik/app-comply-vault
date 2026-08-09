/**
 * Demo bridge: promote an ingested email into an "Email"-typed Meeting.
 *
 * Scope: gated behind isEmailToMeetingEnabled() (demo environments only). This
 * turns a single ingested email into a Meeting so it flows through the
 * dashboard, interaction log and supervision review queue — while staying
 * clearly distinguished from recorded meetings via meetingType = "Email".
 *
 * ⚠️ COMPLIANCE IMPACT: creates Meeting + Flag records and writes audit events.
 * Client attribution auto-creates a Client for the external counterparty so the
 * email never lands in the triage queue during a live demo.
 */

import { db } from "~/server/db";
import { normalizeParticipantAddress, upsertVerifiedAlias } from "./participant-matching";
import { detectMissingDisclosureFlags } from "~/server/flags";
import { getDisclosureProfileForWorkspace } from "~/server/firm-profile/get-disclosure-profile-for-workspace";
import { emailFlagDedupeKey } from "~/server/classification/email-taxonomy";
import {
  EMAIL_MEETING_TYPE,
  buildExtraction,
  deriveNameFromAddress,
  pickCounterparty,
  scanEmailForFlags,
} from "./email-to-meeting-rules";

export { EMAIL_MEETING_TYPE } from "./email-to-meeting-rules";

async function findOrCreateClientForAddress(args: {
  workspaceId: string;
  address: string;
  fallbackName: string;
  contactAt: Date;
}): Promise<{ clientId: string; clientName: string }> {
  const address = normalizeParticipantAddress(args.address);

  const alias = await db.emailAlias.findFirst({
    where: { workspaceId: args.workspaceId, address, clientId: { not: null }, deletedAt: null },
    select: { clientId: true },
  });
  if (alias?.clientId) {
    const existing = await db.client.findFirst({
      where: { id: alias.clientId, workspaceId: args.workspaceId, deletedAt: null },
      select: { id: true, name: true },
    });
    if (existing) return { clientId: existing.id, clientName: existing.name };
  }

  const name = args.fallbackName || deriveNameFromAddress(address);
  const client = await db.client.create({
    data: {
      workspaceId: args.workspaceId,
      name,
      status: "CLIENT",
      lastContactAt: args.contactAt,
    },
    select: { id: true, name: true },
  });
  await upsertVerifiedAlias({
    workspaceId: args.workspaceId,
    address,
    userId: null,
    clientId: client.id,
  });
  return { clientId: client.id, clientName: client.name };
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
  | { status: "created"; meetingId: string; flagCount: number }
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
          speaker: counterparty.name || clientName,
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
    };
  } catch (err) {
    console.error("promoteEmailToMeeting failed (ingest continues)", {
      evidenceItemId: args.evidenceItemId,
      reason: err instanceof Error ? err.message : "unknown",
    });
    return { status: "skipped", reason: "error" };
  }
}
