import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.workspaceId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q")?.trim() || "";

    if (query.length < 2) {
      return NextResponse.json({ results: [] });
    }

    const workspaceId = session.user.workspaceId;

    // Search by client name (case-insensitive)
    const meetings = await db.meeting.findMany({
      where: {
        workspaceId,
        clientName: {
          contains: query,
          mode: "insensitive",
        },
      },
      select: {
        id: true,
        clientName: true,
        meetingDate: true,
        status: true,
        meetingType: true,
      },
      take: 20,
      orderBy: {
        meetingDate: "desc",
      },
    });

    const results = meetings.map((meeting) => ({
      id: meeting.id,
      clientName: meeting.clientName,
      meetingDate: meeting.meetingDate.toISOString(),
      status: meeting.status,
      type: meeting.meetingType,
    }));

    return NextResponse.json({ results });
  } catch (error) {
    console.error("Search error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

