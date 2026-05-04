import type { WorkspaceRole } from "../../generated/prisma";

export function workspaceInitialsFromName(name: string): string {
  const t = name.trim();
  if (t.length === 0) return "WS";
  const parts = t.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  }
  return t.slice(0, 2).toUpperCase();
}

/** Maps Prisma roles to design-doc labels (only two enums in schema). */
export function roleLabelForWorkspace(role: WorkspaceRole): string {
  return role === "OWNER_CCO" ? "CCO" : "Compliance Manager";
}

const MEMBER_PALETTE = ["#3B82F6", "#8B5CF6", "#F97316"] as const;

export function avatarColorForMember(userId: string, role: WorkspaceRole): string {
  if (role === "OWNER_CCO") {
    return "#117A4B";
  }
  let h = 0;
  for (let i = 0; i < userId.length; i++) {
    h = (h + userId.charCodeAt(i) * (i + 1)) % 997;
  }
  return MEMBER_PALETTE[h % MEMBER_PALETTE.length]!;
}
