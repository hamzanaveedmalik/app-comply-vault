import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.workspaceId) {
      return NextResponse.json({ notifications: [] });
    }

    const workspaceId = session.user.workspaceId;
    const userId = session.user.id;

    // Get recent status change events
    const statusChangeEvents = await db.auditEvent.findMany({
      where: {
        workspaceId,
        OR: [
          {
            action: "UPLOAD",
            metadata: {
              path: ["action"],
              equals: "extraction_complete",
            },
          },
          {
            action: "FINALIZE",
          },
        ],
        timestamp: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
        },
      },
      include: {
        meeting: {
          select: {
            id: true,
            clientName: true,
            meetingDate: true,
            status: true,
          },
        },
      },
      orderBy: {
        timestamp: "desc",
      },
      take: 20,
    });

    // Format notifications
    const notifications = statusChangeEvents.map((event) => {
      const isExtractionComplete = event.metadata && 
        typeof event.metadata === "object" && 
        "action" in event.metadata &&
        event.metadata.action === "extraction_complete";

      return {
        id: event.id,
        type: isExtractionComplete ? "processing_complete" : "finalized",
        title: isExtractionComplete
          ? "Meeting Processing Complete"
          : "Meeting Finalized",
        message: event.meeting
          ? `${event.meeting.clientName} - ${isExtractionComplete ? "Ready for review" : "Finalized"}`
          : "Status update",
        meetingId: event.meetingId,
        meeting: event.meeting,
        timestamp: event.timestamp.toISOString(),
        read: false, // TODO: Implement read tracking
      };
    });

    return NextResponse.json({ notifications });
  } catch (error) {
    console.error("Error fetching notifications:", error);
    return NextResponse.json({ notifications: [] });
  }
}

