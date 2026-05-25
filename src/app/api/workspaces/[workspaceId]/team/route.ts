import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { avatarColorForMember, roleLabelForWorkspace } from "~/lib/workspace-display";
import { activeUserWorkspaceWhere } from "~/lib/user-workspace-filters";
import type { TeamMemberDto } from "~/lib/workspace-types";

function initialsFromUser(name: string | null, email: string | null): string {
  const n = (name ?? "").trim();
  if (n.length > 0) {
    const parts = n.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
    }
    return n.slice(0, 2).toUpperCase();
  }
  const e = (email ?? "").trim();
  if (e.length > 0) return e.slice(0, 2).toUpperCase();
  return "??";
}

function displayName(name: string | null, email: string | null): string {
  return (name ?? "").trim() || (email ?? "").trim() || "User";
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ workspaceId: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { workspaceId } = await context.params;

    const membership = await db.userWorkspace.findFirst({
      where: { userId: session.user.id, workspaceId, ...activeUserWorkspaceWhere },
    });

    if (!membership) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const members = await db.userWorkspace.findMany({
      where: { workspaceId, ...activeUserWorkspaceWhere },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: [{ role: "asc" }, { user: { name: "asc" } }],
    });

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentEvents = await db.auditEvent.findMany({
      where: {
        workspaceId,
        timestamp: { gte: since },
      },
      select: { userId: true, timestamp: true },
      orderBy: { timestamp: "desc" },
    });

    const lastActivity = new Map<string, Date>();
    for (const ev of recentEvents) {
      if (!lastActivity.has(ev.userId)) {
        lastActivity.set(ev.userId, ev.timestamp);
      }
    }

    const thirtyMin = new Date(Date.now() - 30 * 60 * 1000);

    const payload: TeamMemberDto[] = members.map((m) => {
      const t = lastActivity.get(m.user.id);
      let status: TeamMemberDto["status"] = "offline";
      if (t) {
        if (t >= thirtyMin) {
          status = "online";
        } else {
          status = "away";
        }
      }

      return {
        id: m.user.id,
        initials: initialsFromUser(m.user.name, m.user.email),
        name: displayName(m.user.name, m.user.email),
        role: roleLabelForWorkspace(m.role),
        status,
        avatarColor: avatarColorForMember(m.user.id, m.role),
      };
    });

    return Response.json(payload);
  } catch (e) {
    console.error("GET /api/workspaces/[workspaceId]/team:", e);
    return Response.json({ error: "Failed to load team" }, { status: 500 });
  }
}
