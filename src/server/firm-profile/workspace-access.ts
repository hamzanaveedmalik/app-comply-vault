import type { WorkspaceRole } from "../../../generated/prisma";
import { db } from "~/server/db";
import { activeUserWorkspaceWhere } from "~/lib/user-workspace-filters";

export type WorkspaceAccessResult =
  | { ok: true; role: WorkspaceRole }
  | { ok: false; status: 401 | 403 | 404 };

export async function getWorkspaceMembership(
  userId: string,
  workspaceId: string,
): Promise<WorkspaceAccessResult> {
  const membership = await db.userWorkspace.findFirst({
    where: {
      userId,
      workspaceId,
      ...activeUserWorkspaceWhere,
    },
    select: { role: true },
  });

  if (!membership) {
    return { ok: false, status: 404 };
  }

  if (membership.role === "ADVISOR") {
    return { ok: false, status: 403 };
  }

  return { ok: true, role: membership.role };
}

export function canWriteCockpit(role: WorkspaceRole): boolean {
  return role === "OWNER_CCO";
}
