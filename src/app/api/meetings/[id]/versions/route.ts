import { auth } from "~/server/auth";
import { db } from "~/server/db";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.workspaceId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Find the meeting
    const meeting = await db.meeting.findFirst({
      where: {
        id,
        workspaceId: session.user.workspaceId,
      },
    });

    if (!meeting) {
      return Response.json({ error: "Meeting not found" }, { status: 404 });
    }

    // Get all versions for this meeting
    const versions = await db.version.findMany({
      where: {
        meetingId: meeting.id,
      },
      orderBy: {
        timestamp: "asc",
      },
    });

    // Get editor information for each version
    const versionsWithEditors = await Promise.all(
      versions.map(async (version) => {
        const editor = await db.user.findUnique({
          where: { id: version.editorId },
          select: {
            id: true,
            name: true,
            email: true,
          },
        });

        return {
          id: version.id,
          version: version.version,
          editor: editor
            ? {
                id: editor.id,
                name: editor.name || editor.email || "Unknown",
                email: editor.email,
              }
            : { id: version.editorId, name: "Unknown", email: null },
          whatChanged: version.whatChanged,
          reason: version.reason,
          timestamp: version.timestamp.toISOString(),
        };
      })
    );

    return Response.json({ versions: versionsWithEditors });
  } catch (error) {
    console.error("Error fetching versions:", error);
    return Response.json(
      { error: "Failed to fetch version history" },
      { status: 500 }
    );
  }
}

