import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.workspaceId) {
      return NextResponse.json({ count: 0 });
    }

    const workspaceId = session.user.workspaceId;
    const userId = session.user.id;

    // Get recent status change events (last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // Get all extraction complete and finalize events
    const statusEvents = await db.auditEvent.findMany({
      where: {
        workspaceId,
        OR: [
          {
            action: "UPLOAD",
            metadata: {
              path: ["action"],
              equals: "extraction_complete",
            },
            timestamp: {
              gte: sevenDaysAgo,
            },
          },
          {
            action: "FINALIZE",
            timestamp: {
              gte: sevenDaysAgo,
            },
          },
        ],
        meetingId: {
          not: null,
        },
      },
      select: {
        id: true,
        meetingId: true,
        timestamp: true,
      },
    });

    if (statusEvents.length === 0) {
      return NextResponse.json({ count: 0 });
    }

    // Get all meetings the user has viewed in the last 7 days
    const viewedMeetings = await db.auditEvent.findMany({
      where: {
        workspaceId,
        userId,
        action: "VIEW",
        meetingId: {
          in: statusEvents.map((e) => e.meetingId!).filter(Boolean),
        },
        timestamp: {
          gte: sevenDaysAgo,
        },
      },
      select: {
        meetingId: true,
        timestamp: true,
      },
    });

    // Create a map of meetingId -> last viewed timestamp
    const viewedMap = new Map<string, Date>();
    for (const view of viewedMeetings) {
      if (!view.meetingId) continue;
      const existing = viewedMap.get(view.meetingId);
      if (!existing || view.timestamp > existing) {
        viewedMap.set(view.meetingId, view.timestamp);
      }
    }

    // Count unread notifications
    let unreadCount = 0;
    for (const event of statusEvents) {
      if (!event.meetingId) continue;
      const lastViewed = viewedMap.get(event.meetingId);
      // If not viewed, or viewed before the status change, it's unread
      if (!lastViewed || lastViewed < event.timestamp) {
        unreadCount++;
      }
    }

    return NextResponse.json({ count: unreadCount });
  } catch (error) {
    console.error("Error fetching notification count:", error);
    return NextResponse.json({ count: 0 });
  }
}

