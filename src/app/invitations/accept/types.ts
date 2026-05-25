export const ACCEPT_PAGE_COLORS = {
  brand: "#117A4B",
  brandDark: "#0c5f3a",
  brandSubtle: "#e9f3ee",
  text: "#111827",
  textSecondary: "#4b5563",
  textTertiary: "#9ca3af",
  surface: "#ffffff",
  bg: "#f9fafb",
  border: "#e5e7eb",
  borderSubtle: "#f3f4f6",
  red: "#b91c1c",
  redBg: "#fef2f2",
} as const;

export const ACCEPT_PAGE_FONT =
  "'Söhne', 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif";

export type InvitationDetails = {
  workspaceName: string;
  role: "OWNER_CCO" | "MEMBER" | "ADVISOR";
  invitedEmail: string;
  inviterName: string | null;
  inviterRole: string | null;
  firmCRD: string | null;
};

export type AcceptScreenState =
  | "loading"
  | "sign-in"
  | "confirm"
  | "accepting"
  | "success"
  | "error";

export type AcceptErrorType = "expired" | "invalid" | "accepted" | "mismatch" | "error";
