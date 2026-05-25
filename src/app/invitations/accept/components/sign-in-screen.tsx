import {
  ACCEPT_PAGE_COLORS,
  ACCEPT_PAGE_FONT,
  type InvitationDetails,
} from "../types";
import { ROLE_CONFIG } from "~/lib/role-config";
import { workspaceInitialsFromName } from "~/lib/workspace-display";

type SignInScreenProps = {
  invitation: InvitationDetails;
  acceptUrl: string;
  onSignIn: () => void;
};

function DetailRow({ label, value }: { label: string; value: string }): React.ReactElement {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 12,
        padding: "8px 0",
        borderBottom: `1px solid ${ACCEPT_PAGE_COLORS.borderSubtle}`,
        fontSize: 13,
      }}
    >
      <span style={{ color: ACCEPT_PAGE_COLORS.textTertiary }}>{label}</span>
      <span style={{ color: ACCEPT_PAGE_COLORS.text, fontWeight: 500, textAlign: "right" }}>
        {value}
      </span>
    </div>
  );
}

export function SignInScreen({
  invitation,
  onSignIn,
}: SignInScreenProps): React.ReactElement {
  const initials = workspaceInitialsFromName(invitation.workspaceName);
  const roleConfig = ROLE_CONFIG[invitation.role];
  const inviterLine =
    invitation.inviterName != null
      ? `${invitation.inviterName} invited you as ${roleConfig.label}`
      : `You have been invited as ${roleConfig.label}`;

  return (
    <div style={{ fontFamily: ACCEPT_PAGE_FONT }}>
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <div
          style={{
            width: 48,
            height: 48,
            margin: "0 auto 12px",
            borderRadius: 10,
            background: ACCEPT_PAGE_COLORS.brandSubtle,
            color: ACCEPT_PAGE_COLORS.brand,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 600,
            fontSize: 16,
          }}
          aria-hidden
        >
          {initials}
        </div>
        <h1
          style={{
            margin: "0 0 8px",
            fontSize: 20,
            fontWeight: 600,
            letterSpacing: "-0.02em",
            color: ACCEPT_PAGE_COLORS.text,
          }}
        >
          {invitation.workspaceName}
        </h1>
        <p style={{ margin: 0, fontSize: 14, color: ACCEPT_PAGE_COLORS.textSecondary }}>
          {inviterLine}
        </p>
      </div>

      <div
        style={{
          border: `1px solid ${ACCEPT_PAGE_COLORS.border}`,
          borderRadius: 8,
          padding: "4px 16px 12px",
          marginBottom: 20,
        }}
      >
        <DetailRow label="Workspace" value={invitation.workspaceName} />
        <DetailRow label="Role" value={roleConfig.label} />
        {invitation.inviterName ? (
          <DetailRow
            label="Invited by"
            value={
              invitation.inviterRole
                ? `${invitation.inviterName} (${invitation.inviterRole})`
                : invitation.inviterName
            }
          />
        ) : null}
        <DetailRow label="Sent to" value={invitation.invitedEmail} />
        {invitation.firmCRD ? (
          <DetailRow label="CRD" value={invitation.firmCRD} />
        ) : null}
      </div>

      <p
        style={{
          margin: "0 0 16px",
          fontSize: 12,
          color: ACCEPT_PAGE_COLORS.textTertiary,
          textAlign: "center",
        }}
      >
        Sign in with {invitation.invitedEmail} to continue
      </p>

      <button
        type="button"
        onClick={onSignIn}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
          padding: "11px 16px",
          border: `1px solid ${ACCEPT_PAGE_COLORS.border}`,
          borderRadius: 8,
          background: ACCEPT_PAGE_COLORS.surface,
          fontSize: 14,
          fontWeight: 500,
          color: ACCEPT_PAGE_COLORS.text,
          cursor: "pointer",
        }}
      >
        <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
          <path
            fill="#FFC107"
            d="M43.611 20.083H42V20H24v8h11.303C33.654 32.657 29.083 36 24 36c-5.514 0-10-4.486-10-10s4.486-10 10-10c2.485 0 4.746.915 6.485 2.425l5.657-5.657C34.046 10.053 29.268 8 24 8 14.059 8 6 16.059 6 26s8.059 18 18 18 18-8.059 18-18c0-1.341-.138-2.65-.389-3.917z"
          />
          <path
            fill="#FF3D00"
            d="M6.306 14.691l6.571 4.819C14.655 16.108 18.961 13 24 13c2.485 0 4.746.915 6.485 2.425l5.657-5.657C34.046 10.053 29.268 8 24 8 16.318 8 9.656 13.337 6.306 14.691z"
          />
          <path
            fill="#4CAF50"
            d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.083 36 24.514 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"
          />
          <path
            fill="#1976D2"
            d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.219 8-11.303 8-5.514 0-10-4.486-10-10s4.486-10 10-10c2.485 0 4.746.915 6.485 2.425l5.657-5.657C34.046 10.053 29.268 8 24 8 14.059 8 6 16.059 6 26c0 1.341.138 2.65.389 3.917z"
          />
        </svg>
        Continue with Google
      </button>
    </div>
  );
}
