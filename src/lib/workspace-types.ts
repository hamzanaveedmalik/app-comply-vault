import type { WorkspaceRole } from "../../generated/prisma";

/** API + UI workspace row (user-scoped list). */
export type WorkspaceListItemDto = {
  id: string;
  initials: string;
  name: string;
  clientCount: number;
  /** Display role at this workspace ("CCO", "Compliance Manager", …). */
  roleLabel: string;
  prismaRole: WorkspaceRole;
};

export type TeamMemberDto = {
  id: string;
  initials: string;
  name: string;
  role: string;
  status: "online" | "away" | "offline";
  avatarColor: string;
};
