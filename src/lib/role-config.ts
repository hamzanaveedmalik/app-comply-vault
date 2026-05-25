export const ROLE_CONFIG = {
  OWNER_CCO: {
    label: "Owner / CCO",
    summary:
      "Finalize records, manage workspace settings, and invite team members.",
    steps: [
      "Configure workspace retention and compliance settings",
      "Invite your team and assign roles",
      "Upload and review your first meeting recording",
    ],
  },
  MEMBER: {
    label: "Compliance Manager",
    summary: "Triage flagged items and support the compliance review workflow.",
    steps: [
      "Review flagged items in your review queue",
      "Collaborate with your CCO on open compliance items",
      "Explore the meeting records dashboard",
    ],
  },
  ADVISOR: {
    label: "Advisor",
    summary: "Review and certify the accuracy of your meeting transcripts.",
    steps: [
      "Review meeting transcripts assigned to you",
      "Certify accuracy and completeness of records",
      "Check your notification preferences",
    ],
  },
} as const;

export type WorkspaceRoleKey = keyof typeof ROLE_CONFIG;

export function roleLabel(role: WorkspaceRoleKey): string {
  return ROLE_CONFIG[role].label;
}

export function roleSummary(role: WorkspaceRoleKey): string {
  return ROLE_CONFIG[role].summary;
}

export function roleSteps(role: WorkspaceRoleKey): readonly string[] {
  return ROLE_CONFIG[role].steps;
}
