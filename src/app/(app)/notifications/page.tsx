import { auth } from "~/server/auth";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import Link from "next/link";
import { Button } from "~/components/ui/button";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const session = await auth();

  if (!session?.user?.workspaceId) {
    redirect("/workspaces/new");
  }

  // Fetch notifications directly from database
  const { db } = await import("~/server/db");
  let notifications: any[] = [];
  
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    
    const events = await db.auditEvent.findMany({
      where: {
        workspaceId: session.user.workspaceId,
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
          gte: sevenDaysAgo,
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
      take: 50,
    });

    notifications = events.map((event) => {
      const metadata = event.metadata as { action?: string } | null;
      const isExtractionComplete = metadata?.action === "extraction_complete";

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
        timestamp: event.timestamp,
      };
    });
  } catch (error) {
    console.error("Error fetching notifications:", error);
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Notifications</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Recent activity and status updates
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Notifications</CardTitle>
          <CardDescription>
            Meeting status changes and updates
          </CardDescription>
        </CardHeader>
        <CardContent>
          {notifications.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No notifications
            </div>
          ) : (
            <div className="space-y-4">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className="flex items-start justify-between gap-4 p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge
                        variant={
                          notification.type === "processing_complete"
                            ? "default"
                            : "secondary"
                        }
                      >
                        {notification.type === "processing_complete"
                          ? "Processing Complete"
                          : "Finalized"}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(notification.timestamp).toLocaleString()}
                      </span>
                    </div>
                    <h3 className="font-medium">{notification.title}</h3>
                    <p className="text-sm text-muted-foreground">
                      {notification.message}
                    </p>
                  </div>
                  {notification.meetingId && (
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/meetings/${notification.meetingId}`}>
                        View
                      </Link>
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

