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
      },
      select: {
        id: true,
        meetingId: true,
        timestamp: true,
      },
    });

    // For each event, check if user has viewed the meeting
    let unreadCount = 0;
    for (const event of statusEvents) {
      if (!event.meetingId) continue;

      // Check if user has viewed this meeting after the status change
      const hasViewed = await db.auditEvent.findFirst({
        where: {
          workspaceId,
          userId,
          action: "VIEW",
          meetingId: event.meetingId,
          timestamp: {
            gte: event.timestamp,
          },
        },
      });

      if (!hasViewed) {
        unreadCount++;
      }
    }

    return NextResponse.json({ count: unreadCount });
  } catch (error) {
    console.error("Error fetching notification count:", error);
    return NextResponse.json({ count: 0 });
  }
}

