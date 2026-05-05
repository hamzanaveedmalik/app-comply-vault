import type { TeamMember, Workspace } from "~/lib/types";
import type { WorkspaceListItemDto } from "~/lib/workspace-types";

/** Map server DTO to workspace dropdown shape (`role` vs `roleLabel`). */
export function workspaceDtoToWorkspace(dto: WorkspaceListItemDto): Workspace {
  return {
    id: dto.id,
    initials: dto.initials,
    name: dto.name,
    clientCount: dto.clientCount,
    role: dto.roleLabel,
  };
}

export async function fetchWorkspaces(): Promise<Workspace[]> {
  const res = await fetch("/api/workspaces");
  if (!res.ok) {
    throw new Error("Failed to load workspaces");
  }
  const data = (await res.json()) as WorkspaceListItemDto[];
  return data.map(workspaceDtoToWorkspace);
}

export async function fetchTeamMembers(workspaceId: string): Promise<TeamMember[]> {
  const res = await fetch(`/api/workspaces/${workspaceId}/team`);
  if (!res.ok) {
    return [];
  }
  return (await res.json()) as TeamMember[];
}
