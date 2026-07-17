import { auth } from "~/server/auth";
import { NextResponse } from "next/server";
import { getUnreadNotificationCount } from "~/server/notifications";

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.workspaceId) {
      return NextResponse.json({ count: 0 });
    }

    const count = await getUnreadNotificationCount(
      session.user.workspaceId,
      session.user.id,
    );

    return NextResponse.json({ count });
  } catch (error) {
    console.error("Error fetching notification count:", error);
    return NextResponse.json({ count: 0 });
  }
}
