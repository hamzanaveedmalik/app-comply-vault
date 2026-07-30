/**
 * Meeting → Client attribution.
 * Pass 1: participant emails → EmailAlias / household (authoritative).
 * Pass 2: exact normalised name match when no participant emails (low confidence).
 * Ambiguous / unmatched → leave for review UI (never guess).
 */

import { db } from "~/server/db";
import { getHouseholdClientIds } from "~/server/clients/household";
import { normalizeParticipantAddress } from "~/server/mailbox/participant-matching";
import type { MeetingClientMatchConfidence } from "../../../generated/prisma";
import type { NeedsAttributionMeetingDto } from "~/lib/types/clients";

export type AttributionOutcome =
  | {
      status: "matched";
      clientId: string;
      confidence: MeetingClientMatchConfidence;
    }
  | { status: "unmatched" }
  | { status: "ambiguous"; reason: string };

export function normalizeClientName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Resolve client ids from participant emails via verified/known EmailAlias rows.
 * Multiple clients in the same household → pick the first (EMAIL confidence).
 * Multiple clients across households → ambiguous (review).
 */
export async function resolveClientFromParticipantEmails(args: {
  workspaceId: string;
  emails: string[];
}): Promise<AttributionOutcome> {
  const addresses = [
    ...new Set(
      args.emails
        .map((e) => normalizeParticipantAddress(e))
        .filter((e) => e.includes("@"))
    ),
  ];
  if (addresses.length === 0) {
    return { status: "unmatched" };
  }

  const aliases = await db.emailAlias.findMany({
    where: {
      workspaceId: args.workspaceId,
      address: { in: addresses },
      clientId: { not: null },
      deletedAt: null,
    },
    select: { clientId: true },
  });

  const clientIds = [
    ...new Set(
      aliases
        .map((a) => a.clientId)
        .filter((id): id is string => typeof id === "string" && id.length > 0)
    ),
  ];

  if (clientIds.length === 0) {
    return { status: "unmatched" };
  }
  if (clientIds.length === 1) {
    return {
      status: "matched",
      clientId: clientIds[0]!,
      confidence: "EMAIL",
    };
  }

  // Check whether all matched clients share one household.
  const householdSets = await Promise.all(
    clientIds.map((clientId) =>
      getHouseholdClientIds({ workspaceId: args.workspaceId, clientId })
    )
  );
  const firstSet = new Set(householdSets[0] ?? []);
  const allSameHousehold = householdSets.every(
    (set) =>
      set.length === firstSet.size && set.every((id) => firstSet.has(id))
  );

  if (allSameHousehold) {
    return {
      status: "matched",
      clientId: clientIds[0]!,
      confidence: "EMAIL",
    };
  }

  return {
    status: "ambiguous",
    reason: "participants_span_multiple_households",
  };
}

/**
 * Exact normalised name match within a workspace. Duplicate names → ambiguous.
 */
export async function resolveClientFromExactName(args: {
  workspaceId: string;
  clientName: string;
}): Promise<AttributionOutcome> {
  const key = normalizeClientName(args.clientName);
  if (!key) return { status: "unmatched" };

  const clients = await db.client.findMany({
    where: { workspaceId: args.workspaceId, deletedAt: null },
    select: { id: true, name: true },
  });

  const matches = clients.filter(
    (c) => normalizeClientName(c.name) === key
  );

  if (matches.length === 0) return { status: "unmatched" };
  if (matches.length > 1) {
    return { status: "ambiguous", reason: "duplicate_client_names" };
  }

  return {
    status: "matched",
    clientId: matches[0]!.id,
    confidence: "NAME_EXACT",
  };
}

/**
 * Attribute a single meeting. Does not overwrite MANUAL attributions.
 */
export async function attributeMeeting(args: {
  meetingId: string;
  workspaceId: string;
}): Promise<AttributionOutcome> {
  const meeting = await db.meeting.findFirst({
    where: { id: args.meetingId, workspaceId: args.workspaceId },
    select: {
      id: true,
      clientName: true,
      clientId: true,
      clientMatchConfidence: true,
      participantEmails: true,
    },
  });
  if (!meeting) return { status: "unmatched" };

  if (meeting.clientMatchConfidence === "MANUAL" && meeting.clientId) {
    return {
      status: "matched",
      clientId: meeting.clientId,
      confidence: "MANUAL",
    };
  }

  const emails = meeting.participantEmails ?? [];
  if (emails.length > 0) {
    const emailOutcome = await resolveClientFromParticipantEmails({
      workspaceId: args.workspaceId,
      emails,
    });
    if (emailOutcome.status === "matched") {
      await applyAttribution({
        meetingId: meeting.id,
        clientId: emailOutcome.clientId,
        confidence: emailOutcome.confidence,
      });
      return emailOutcome;
    }
    // Emails present but unmatched/ambiguous → leave for review (no name guess).
    if (meeting.clientId) {
      await clearAttribution(meeting.id);
    }
    return emailOutcome;
  }

  const nameOutcome = await resolveClientFromExactName({
    workspaceId: args.workspaceId,
    clientName: meeting.clientName,
  });
  // CV-OB-01: name similarity never auto-confirms — hold for CCO confirmation.
  if (nameOutcome.status === "matched") {
    if (meeting.clientId) {
      await clearAttribution(meeting.id);
    }
    return {
      status: "ambiguous",
      reason: "name_exact_held_for_confirmation",
    };
  }

  if (meeting.clientId) {
    await clearAttribution(meeting.id);
  }
  return nameOutcome;
}

async function applyAttribution(args: {
  meetingId: string;
  clientId: string;
  confidence: MeetingClientMatchConfidence;
}): Promise<void> {
  await db.meeting.update({
    where: { id: args.meetingId },
    data: {
      clientId: args.clientId,
      clientMatchConfidence: args.confidence,
    },
  });
}

async function clearAttribution(meetingId: string): Promise<void> {
  await db.meeting.update({
    where: { id: meetingId },
    data: { clientId: null, clientMatchConfidence: null },
  });
}

/**
 * User resolves attribution from the review UI.
 */
export async function resolveMeetingClientAttribution(args: {
  workspaceId: string;
  meetingId: string;
  clientId: string;
  userId: string;
}): Promise<{ success: true } | { success: false; error: string }> {
  const meeting = await db.meeting.findFirst({
    where: { id: args.meetingId, workspaceId: args.workspaceId },
    select: { id: true },
  });
  if (!meeting) {
    return { success: false, error: "Meeting not found" };
  }

  const client = await db.client.findFirst({
    where: {
      id: args.clientId,
      workspaceId: args.workspaceId,
      deletedAt: null,
    },
    select: { id: true },
  });
  if (!client) {
    return { success: false, error: "Client not found" };
  }

  await db.$transaction([
    db.meeting.update({
      where: { id: meeting.id },
      data: {
        clientId: client.id,
        clientMatchConfidence: "MANUAL",
      },
    }),
    db.auditEvent.create({
      data: {
        workspaceId: args.workspaceId,
        userId: args.userId,
        action: "MEETING_CLIENT_ATTRIBUTED",
        resourceType: "meeting",
        resourceId: meeting.id,
        meetingId: meeting.id,
        metadata: {
          clientId: client.id,
          confidence: "MANUAL",
        },
      },
    }),
  ]);

  return { success: true };
}

export type { NeedsAttributionMeetingDto };

/**
 * Meetings needing human attribution: unmatched, NAME_EXACT, or still null after emails.
 */
export async function listMeetingsNeedingAttribution(
  workspaceId: string
): Promise<NeedsAttributionMeetingDto[]> {
  const rows = await db.meeting.findMany({
    where: {
      workspaceId,
      OR: [
        { clientId: null },
        { clientMatchConfidence: "NAME_EXACT" },
      ],
    },
    orderBy: { meetingDate: "desc" },
    take: 200,
    select: {
      id: true,
      clientName: true,
      meetingDate: true,
      meetingType: true,
      clientId: true,
      clientMatchConfidence: true,
      participantEmails: true,
    },
  });

  return rows.map((r) => {
    let reason: NeedsAttributionMeetingDto["reason"] = "unmatched";
    if (r.clientMatchConfidence === "NAME_EXACT") {
      reason = "low_confidence";
    } else if ((r.participantEmails?.length ?? 0) > 0 && !r.clientId) {
      reason = "ambiguous";
    }
    return {
      id: r.id,
      clientName: r.clientName,
      meetingDate: r.meetingDate.toISOString(),
      meetingType: r.meetingType,
      clientId: r.clientId,
      clientMatchConfidence: r.clientMatchConfidence,
      participantEmails: r.participantEmails ?? [],
      reason,
    };
  });
}

export type BackfillAttributionStats = {
  processed: number;
  matchedEmail: number;
  matchedName: number;
  unmatched: number;
  ambiguous: number;
  skippedManual: number;
  cursor: string | null;
  done: boolean;
};

/**
 * Resumable backfill: attribute meetings in batches by id cursor.
 */
export async function backfillMeetingClientAttribution(args: {
  workspaceId?: string;
  cursor?: string | null;
  batchSize?: number;
}): Promise<BackfillAttributionStats> {
  const batchSize = args.batchSize ?? 50;
  const meetings = await db.meeting.findMany({
    where: {
      ...(args.workspaceId ? { workspaceId: args.workspaceId } : {}),
      ...(args.cursor ? { id: { gt: args.cursor } } : {}),
      OR: [
        { clientId: null },
        { clientMatchConfidence: { not: "MANUAL" } },
      ],
    },
    orderBy: { id: "asc" },
    take: batchSize,
    select: { id: true, workspaceId: true, clientMatchConfidence: true },
  });

  const stats: BackfillAttributionStats = {
    processed: 0,
    matchedEmail: 0,
    matchedName: 0,
    unmatched: 0,
    ambiguous: 0,
    skippedManual: 0,
    cursor: null,
    done: meetings.length < batchSize,
  };

  for (const m of meetings) {
    stats.processed += 1;
    stats.cursor = m.id;
    if (m.clientMatchConfidence === "MANUAL") {
      stats.skippedManual += 1;
      continue;
    }
    const outcome = await attributeMeeting({
      meetingId: m.id,
      workspaceId: m.workspaceId,
    });
    if (outcome.status === "matched") {
      if (outcome.confidence === "EMAIL") stats.matchedEmail += 1;
      else if (outcome.confidence === "NAME_EXACT") stats.matchedName += 1;
      else stats.skippedManual += 1;
    } else if (outcome.status === "ambiguous") {
      stats.ambiguous += 1;
    } else {
      stats.unmatched += 1;
    }
  }

  return stats;
}
