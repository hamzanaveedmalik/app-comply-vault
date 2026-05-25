import {
  ACCEPT_PAGE_COLORS,
  ACCEPT_PAGE_FONT,
  type InvitationDetails,
} from "../types";
import { ROLE_CONFIG } from "~/lib/role-config";
import { workspaceInitialsFromName } from "~/lib/workspace-display";

type ConfirmScreenProps = {
  invitation: InvitationDetails;
  signedInEmail: string;
  isAccepting: boolean;
  onAccept: () => void;
  onSwitchAccount: () => void;
};

export function ConfirmScreen({
  invitation,
  signedInEmail,
  isAccepting,
  onAccept,
  onSwitchAccount,
}: ConfirmScreenProps): React.ReactElement {
  const initials = workspaceInitialsFromName(invitation.workspaceName);
  const roleConfig = ROLE_CONFIG[invitation.role];

  const headerMeta = [
    invitation.inviterName ? `Invited by ${invitation.inviterName}` : null,
    invitation.firmCRD ? `CRD ${invitation.firmCRD}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div style={{ fontFamily: ACCEPT_PAGE_FONT }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 8,
              background: ACCEPT_PAGE_COLORS.brandSubtle,
              color: ACCEPT_PAGE_COLORS.brand,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 600,
              fontSize: 14,
              flexShrink: 0,
            }}
            aria-hidden
          >
            {initials}
          </div>
          <div>
            <h1
              style={{
                margin: 0,
                fontSize: 18,
                fontWeight: 600,
                letterSpacing: "-0.02em",
                color: ACCEPT_PAGE_COLORS.text,
              }}
            >
              {invitation.workspaceName}
            </h1>
            {headerMeta ? (
              <p style={{ margin: "4px 0 0", fontSize: 12, color: ACCEPT_PAGE_COLORS.textTertiary }}>
                {headerMeta}
              </p>
            ) : null}
          </div>
        </div>
      </div>

      <div
        style={{
          border: `1px solid ${ACCEPT_PAGE_COLORS.border}`,
          borderRadius: 8,
          padding: 16,
          marginBottom: 16,
        }}
      >
        <div style={{ fontSize: 11, fontWeight: 500, color: ACCEPT_PAGE_COLORS.textTertiary, marginBottom: 8 }}>
          Your role
        </div>
        <div
          style={{
            display: "inline-block",
            padding: "2px 8px",
            borderRadius: 4,
            background: ACCEPT_PAGE_COLORS.brandSubtle,
            color: ACCEPT_PAGE_COLORS.brand,
            fontSize: 12,
            fontWeight: 500,
            marginBottom: 10,
          }}
        >
          {roleConfig.label}
        </div>
        <p style={{ margin: "0 0 16px", fontSize: 13, color: ACCEPT_PAGE_COLORS.textSecondary, lineHeight: 1.5 }}>
          {roleConfig.summary}
        </p>
        <div style={{ fontSize: 12, fontWeight: 500, color: ACCEPT_PAGE_COLORS.text, marginBottom: 8 }}>
          Getting started
        </div>
        <ol
          style={{
            margin: 0,
            paddingLeft: 18,
            fontSize: 13,
            color: ACCEPT_PAGE_COLORS.textSecondary,
            lineHeight: 1.6,
          }}
        >
          {roleConfig.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "10px 12px",
          borderRadius: 6,
          background: ACCEPT_PAGE_COLORS.brandSubtle,
          marginBottom: 16,
          fontSize: 13,
          color: ACCEPT_PAGE_COLORS.brandDark,
        }}
      >
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: ACCEPT_PAGE_COLORS.brand,
            flexShrink: 0,
          }}
          aria-hidden
        />
        {signedInEmail}
      </div>

      <button
        type="button"
        onClick={onAccept}
        disabled={isAccepting}
        style={{
          width: "100%",
          padding: "11px 16px",
          border: "none",
          borderRadius: 8,
          background: isAccepting ? ACCEPT_PAGE_COLORS.textTertiary : ACCEPT_PAGE_COLORS.brand,
          color: "#fff",
          fontSize: 14,
          fontWeight: 500,
          cursor: isAccepting ? "not-allowed" : "pointer",
          marginBottom: 12,
        }}
      >
        {isAccepting ? "Joining…" : "Join workspace"}
      </button>

      <p style={{ margin: 0, textAlign: "center", fontSize: 12, color: ACCEPT_PAGE_COLORS.textTertiary }}>
        Wrong account?{" "}
        <button
          type="button"
          onClick={onSwitchAccount}
          style={{
            background: "none",
            border: "none",
            padding: 0,
            color: ACCEPT_PAGE_COLORS.brand,
            fontWeight: 500,
            cursor: "pointer",
            textDecoration: "underline",
          }}
        >
          Switch
        </button>
      </p>
    </div>
  );
}
