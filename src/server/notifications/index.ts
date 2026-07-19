import { db } from "~/server/db";
import type { AuditEvent, Meeting, Prisma } from "../../../generated/prisma";

export const NOTIFICATION_LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000;

export type NotificationMeeting = Pick<
  Meeting,
  "id" | "clientName" | "meetingDate" | "status"
>;

export type NotificationType =
  | "processing_complete"
  | "finalized"
  | "member_joined"
  | "member_removed";

export type NotificationItem = {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  meetingId: string | null;
  meeting: NotificationMeeting | null;
  /** Optional in-app link (e.g. team settings for membership events) */
  href: string | null;
  timestamp: Date;
  read: boolean;
};

const WORKSPACE_ROLE_LABELS: Record<string, string> = {
  OWNER_CCO: "Owner / CCO",
  MEMBER: "Compliance Manager",
  ADVISOR: "Advisor",
};

function roleLabelFor(role: unknown): string {
  return typeof role === "string" ? (WORKSPACE_ROLE_LABELS[role] ?? "team member") : "team member";
}

function metadataString(metadata: unknown, key: string): string | null {
  if (metadata !== null && typeof metadata === "object" && key in metadata) {
    const value = (metadata as Record<string, unknown>)[key];
    return typeof value === "string" ? value : null;
  }
  return null;
}

export function notificationSinceDate(): Date {
  return new Date(Date.now() - NOTIFICATION_LOOKBACK_MS);
}

export function resolveNotificationMeetingId(event: {
  meetingId: string | null;
  resourceType: string;
  resourceId: string;
}): string | null {
  if (event.meetingId) return event.meetingId;
  if (event.resourceType === "meeting") return event.resourceId;
  return null;
}

export function isExtractionCompleteMetadata(metadata: unknown): boolean {
  return (
    metadata !== null &&
    typeof metadata === "object" &&
    "action" in metadata &&
    (metadata as { action?: string }).action === "extraction_complete"
  );
}

function statusChangeEventsWhere(
  workspaceId: string,
  since: Date,
): Prisma.AuditEventWhereInput {
  return {
    workspaceId,
    OR: [
      {
        action: "UPLOAD",
        metadata: {
          path: ["action"],
          equals: "extraction_complete",
        },
        timestamp: { gte: since },
      },
      {
        action: "FINALIZE",
        timestamp: { gte: since },
      },
    ],
  };
}

type StatusChangeEvent = Pick<
  AuditEvent,
  "id" | "meetingId" | "resourceType" | "resourceId" | "timestamp" | "metadata"
>;

async function fetchStatusChangeEvents(
  workspaceId: string,
  since: Date,
  take?: number,
): Promise<StatusChangeEvent[]> {
  return db.auditEvent.findMany({
    where: statusChangeEventsWhere(workspaceId, since),
    select: {
      id: true,
      meetingId: true,
      resourceType: true,
      resourceId: true,
      timestamp: true,
      metadata: true,
    },
    orderBy: { timestamp: "desc" },
    ...(take !== undefined ? { take } : {}),
  });
}

async function loadMeetingsById(
  workspaceId: string,
  meetingIds: string[],
): Promise<Map<string, NotificationMeeting>> {
  if (meetingIds.length === 0) return new Map();

  const meetings = await db.meeting.findMany({
    where: {
      workspaceId,
      id: { in: meetingIds },
    },
    select: {
      id: true,
      clientName: true,
      meetingDate: true,
      status: true,
    },
  });

  return new Map(meetings.map((meeting) => [meeting.id, meeting]));
}

function formatNotificationItem(
  event: StatusChangeEvent,
  meeting: NotificationMeeting | null,
  read: boolean,
): NotificationItem {
  const isExtractionComplete = isExtractionCompleteMetadata(event.metadata);
  const meetingId = resolveNotificationMeetingId(event);

  return {
    id: event.id,
    type: isExtractionComplete ? "processing_complete" : "finalized",
    title: isExtractionComplete
      ? "Meeting Processing Complete"
      : "Meeting Finalized",
    message: meeting
      ? `${meeting.clientName} - ${isExtractionComplete ? "Ready for review" : "Finalized"}`
      : "Status update",
    meetingId,
    meeting,
    href: meetingId ? `/meetings/${meetingId}` : null,
    timestamp: event.timestamp,
    read,
  };
}

// ── Team / membership notifications ─────────────────────────────

type TeamEvent = Pick<
  AuditEvent,
  "id" | "userId" | "action" | "timestamp" | "metadata"
>;

function teamEventsWhere(
  workspaceId: string,
  since: Date,
): Prisma.AuditEventWhereInput {
  return {
    workspaceId,
    action: { in: ["INVITE_ACCEPTED", "MEMBER_REMOVED"] },
    timestamp: { gte: since },
  };
}

async function fetchTeamEvents(
  workspaceId: string,
  since: Date,
  take?: number,
): Promise<TeamEvent[]> {
  return db.auditEvent.findMany({
    where: teamEventsWhere(workspaceId, since),
    select: {
      id: true,
      userId: true,
      action: true,
      timestamp: true,
      metadata: true,
    },
    orderBy: { timestamp: "desc" },
    ...(take !== undefined ? { take } : {}),
  });
}

async function loadUserNames(userIds: string[]): Promise<Map<string, string>> {
  if (userIds.length === 0) return new Map();
  const users = await db.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true, email: true },
  });
  return new Map(
    users.map((u) => [u.id, u.name?.trim() || u.email || "A new member"]),
  );
}

/**
 * A membership event is unread for everyone except the person who performed it
 * (the joiner for INVITE_ACCEPTED, the remover for MEMBER_REMOVED).
 */
function isTeamEventUnread(event: TeamEvent, currentUserId: string): boolean {
  return event.userId !== currentUserId;
}

function formatTeamItem(
  event: TeamEvent,
  actorName: string,
  currentUserId: string,
): NotificationItem {
  if (event.action === "MEMBER_REMOVED") {
    const removedEmail = metadataString(event.metadata, "removedEmail");
    const removedRole = roleLabelFor(metadataString(event.metadata, "removedRole"));
    return {
      id: event.id,
      type: "member_removed",
      title: "Team member removed",
      message: removedEmail
        ? `${removedEmail} (${removedRole}) was removed from the workspace`
        : "A team member was removed from the workspace",
      meetingId: null,
      meeting: null,
      href: "/settings/workspace",
      timestamp: event.timestamp,
      read: !isTeamEventUnread(event, currentUserId),
    };
  }

  const role = roleLabelFor(metadataString(event.metadata, "role"));
  return {
    id: event.id,
    type: "member_joined",
    title: `New ${role} joined`,
    message: `${actorName} joined the workspace as ${role}`,
    meetingId: null,
    meeting: null,
    href: "/settings/workspace",
    timestamp: event.timestamp,
    read: !isTeamEventUnread(event, currentUserId),
  };
}

async function buildViewedMap(
  workspaceId: string,
  userId: string,
  meetingIds: string[],
  since: Date,
): Promise<Map<string, Date>> {
  if (meetingIds.length === 0) return new Map();

  const viewedMeetings = await db.auditEvent.findMany({
    where: {
      workspaceId,
      userId,
      action: "VIEW",
      meetingId: { in: meetingIds },
      timestamp: { gte: since },
    },
    select: {
      meetingId: true,
      timestamp: true,
    },
  });

  const viewedMap = new Map<string, Date>();
  for (const view of viewedMeetings) {
    if (!view.meetingId) continue;
    const existing = viewedMap.get(view.meetingId);
    if (!existing || view.timestamp > existing) {
      viewedMap.set(view.meetingId, view.timestamp);
    }
  }
  return viewedMap;
}

function isEventUnread(
  event: StatusChangeEvent,
  viewedMap: Map<string, Date>,
): boolean {
  const meetingId = resolveNotificationMeetingId(event);
  if (!meetingId) return false;
  const lastViewed = viewedMap.get(meetingId);
  return !lastViewed || lastViewed < event.timestamp;
}

export async function getUnreadNotificationCount(
  workspaceId: string,
  userId: string,
): Promise<number> {
  const since = notificationSinceDate();
  const [statusEvents, teamEvents] = await Promise.all([
    fetchStatusChangeEvents(workspaceId, since),
    fetchTeamEvents(workspaceId, since),
  ]);

  const teamUnread = teamEvents.filter((event) =>
    isTeamEventUnread(event, userId),
  ).length;

  if (statusEvents.length === 0) return teamUnread;

  const meetingIds = [
    ...new Set(
      statusEvents
        .map((event) => resolveNotificationMeetingId(event))
        .filter((id): id is string => id !== null),
    ),
  ];

  const viewedMap = await buildViewedMap(workspaceId, userId, meetingIds, since);

  const meetingUnread = statusEvents.filter((event) =>
    isEventUnread(event, viewedMap),
  ).length;

  return meetingUnread + teamUnread;
}

export async function listNotifications(
  workspaceId: string,
  userId: string,
  limit = 50,
): Promise<NotificationItem[]> {
  const since = notificationSinceDate();
  const [events, teamEvents] = await Promise.all([
    fetchStatusChangeEvents(workspaceId, since, limit),
    fetchTeamEvents(workspaceId, since, limit),
  ]);

  const meetingIds = [
    ...new Set(
      events
        .map((event) => resolveNotificationMeetingId(event))
        .filter((id): id is string => id !== null),
    ),
  ];

  // For INVITE_ACCEPTED the acting user is the person who joined.
  const joinerIds = [
    ...new Set(
      teamEvents
        .filter((event) => event.action === "INVITE_ACCEPTED")
        .map((event) => event.userId),
    ),
  ];

  const [meetingsById, viewedMap, userNames] = await Promise.all([
    loadMeetingsById(workspaceId, meetingIds),
    buildViewedMap(workspaceId, userId, meetingIds, since),
    loadUserNames(joinerIds),
  ]);

  const meetingItems = events.map((event) => {
    const meetingId = resolveNotificationMeetingId(event);
    const meeting = meetingId ? (meetingsById.get(meetingId) ?? null) : null;
    return formatNotificationItem(event, meeting, !isEventUnread(event, viewedMap));
  });

  const teamItems = teamEvents.map((event) =>
    formatTeamItem(event, userNames.get(event.userId) ?? "A new member", userId),
  );

  return [...meetingItems, ...teamItems]
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    .slice(0, limit);
}
