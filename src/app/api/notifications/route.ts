import { auth } from "~/server/auth";
import { NextResponse } from "next/server";
import { listNotifications } from "~/server/notifications";

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.workspaceId) {
      return NextResponse.json({ notifications: [] });
    }

    const notifications = await listNotifications(
      session.user.workspaceId,
      session.user.id,
      20,
    );

    return NextResponse.json({
      notifications: notifications.map((notification) => ({
        ...notification,
        timestamp: notification.timestamp.toISOString(),
      })),
    });
  } catch (error) {
    console.error("Error fetching notifications:", error);
    return NextResponse.json({ notifications: [] });
  }
}
