import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { NextResponse } from "next/server";

/**
 * Get meeting status - used for polling status changes
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.workspaceId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const workspaceId = session.user.workspaceId;

    const meeting = await db.meeting.findFirst({
      where: {
        id,
        workspaceId,
      },
      select: {
        id: true,
        status: true,
        clientName: true,
        draftReadyAt: true,
        finalizedAt: true,
        updatedAt: true,
      },
    });

    if (!meeting) {
      return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
    }

    const agg = await db.flag.aggregate({
      where: { meetingId: id },
      _max: { updatedAt: true },
    });

    const maxFlagAt = agg._max.updatedAt;
    const syncToken = `${meeting.status}|${meeting.updatedAt.toISOString()}|${maxFlagAt?.toISOString() ?? "none"}`;

    return NextResponse.json({
      id: meeting.id,
      status: meeting.status,
      clientName: meeting.clientName,
      draftReadyAt: meeting.draftReadyAt?.toISOString() || null,
      finalizedAt: meeting.finalizedAt?.toISOString() || null,
      updatedAt: meeting.updatedAt.toISOString(),
      maxFlagUpdatedAt: maxFlagAt?.toISOString() ?? null,
      syncToken,
    });
  } catch (error) {
    console.error("Error fetching meeting status:", error);
    return NextResponse.json(
      { error: "Failed to fetch meeting status" },
      { status: 500 }
    );
  }
}

