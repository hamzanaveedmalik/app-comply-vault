import { db } from "~/server/db";
import { workspaceInitialsFromName, roleLabelForWorkspace } from "~/lib/workspace-display";
import { activeUserWorkspaceWhere } from "~/lib/user-workspace-filters";
import type { WorkspaceListItemDto } from "~/lib/workspace-types";

export async function listWorkspacesForUser(userId: string): Promise<WorkspaceListItemDto[]> {
  const memberships = await db.userWorkspace.findMany({
    where: { userId, ...activeUserWorkspaceWhere },
    include: {
      workspace: { select: { id: true, name: true } },
    },
    orderBy: { workspace: { name: "asc" } },
  });

  if (memberships.length === 0) {
    return [];
  }

  const ids = memberships.map((m) => m.workspace.id);
  const meetings = await db.meeting.findMany({
    where: { workspaceId: { in: ids } },
    select: { workspaceId: true, clientName: true },
  });

  const clientSets = new Map<string, Set<string>>();
  for (const id of ids) {
    clientSets.set(id, new Set());
  }
  for (const m of meetings) {
    clientSets.get(m.workspaceId)?.add(m.clientName);
  }

  return memberships.map((m) => ({
    id: m.workspace.id,
    initials: workspaceInitialsFromName(m.workspace.name),
    name: m.workspace.name,
    clientCount: clientSets.get(m.workspace.id)?.size ?? 0,
    roleLabel: roleLabelForWorkspace(m.role),
    prismaRole: m.role,
  }));
}
