import { db } from "~/server/db";
import type { AuditEvent, Meeting, Prisma } from "../../../generated/prisma";

export const NOTIFICATION_LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000;

export type NotificationMeeting = Pick<
  Meeting,
  "id" | "clientName" | "meetingDate" | "status"
>;

export type NotificationItem = {
  id: string;
  type: "processing_complete" | "finalized";
  title: string;
  message: string;
  meetingId: string | null;
  meeting: NotificationMeeting | null;
  timestamp: Date;
  read: boolean;
};

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
    timestamp: event.timestamp,
    read,
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
  const statusEvents = await fetchStatusChangeEvents(workspaceId, since);

  if (statusEvents.length === 0) return 0;

  const meetingIds = [
    ...new Set(
      statusEvents
        .map((event) => resolveNotificationMeetingId(event))
        .filter((id): id is string => id !== null),
    ),
  ];

  const viewedMap = await buildViewedMap(workspaceId, userId, meetingIds, since);

  return statusEvents.filter((event) => isEventUnread(event, viewedMap)).length;
}

export async function listNotifications(
  workspaceId: string,
  userId: string,
  limit = 50,
): Promise<NotificationItem[]> {
  const since = notificationSinceDate();
  const events = await fetchStatusChangeEvents(workspaceId, since, limit);

  if (events.length === 0) return [];

  const meetingIds = [
    ...new Set(
      events
        .map((event) => resolveNotificationMeetingId(event))
        .filter((id): id is string => id !== null),
    ),
  ];

  const [meetingsById, viewedMap] = await Promise.all([
    loadMeetingsById(workspaceId, meetingIds),
    buildViewedMap(workspaceId, userId, meetingIds, since),
  ]);

  return events.map((event) => {
    const meetingId = resolveNotificationMeetingId(event);
    const meeting = meetingId ? (meetingsById.get(meetingId) ?? null) : null;
    return formatNotificationItem(event, meeting, !isEventUnread(event, viewedMap));
  });
}
