/** Workspace dropdown & shell — aligned with dashboard workspace UI spec. */
export type Workspace = {
  id: string;
  initials: string;
  name: string;
  clientCount: number;
  role: string;
};

export type TeamMember = {
  id: string;
  initials: string;
  name: string;
  role: string;
  status: "online" | "away" | "offline";
  avatarColor: string;
};
