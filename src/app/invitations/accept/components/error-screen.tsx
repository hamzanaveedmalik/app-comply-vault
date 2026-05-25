import Link from "next/link";
import {
  ACCEPT_PAGE_COLORS,
  ACCEPT_PAGE_FONT,
  type AcceptErrorType,
} from "../types";

type ErrorScreenProps = {
  errorType: AcceptErrorType;
  currentEmail?: string;
  invitedEmail?: string;
  onSwitchAccount?: () => void;
};

const SUPPORT_URL = "mailto:support@complyvault.com";

export function ErrorScreen({
  errorType,
  currentEmail,
  invitedEmail,
  onSwitchAccount,
}: ErrorScreenProps): React.ReactElement {
  const config = getErrorConfig(errorType, currentEmail, invitedEmail);

  return (
    <div
      style={{
        textAlign: "center",
        padding: "32px 16px",
        fontFamily: ACCEPT_PAGE_FONT,
      }}
      role="alert"
      aria-live="assertive"
    >
      <div
        style={{
          width: 48,
          height: 48,
          margin: "0 auto 16px",
          borderRadius: 10,
          background: ACCEPT_PAGE_COLORS.redBg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
          <circle cx="12" cy="12" r="10" stroke={ACCEPT_PAGE_COLORS.red} strokeWidth="2" />
          <path
            d="M12 8v5M12 16h.01"
            stroke={ACCEPT_PAGE_COLORS.red}
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
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
        {config.title}
      </h1>
      <p
        style={{
          margin: "0 0 20px",
          fontSize: 14,
          color: ACCEPT_PAGE_COLORS.textSecondary,
          lineHeight: 1.5,
        }}
      >
        {config.body}
      </p>
      {config.action === "support" ? (
        <Link
          href={SUPPORT_URL}
          style={{
            display: "inline-block",
            fontSize: 14,
            fontWeight: 500,
            color: ACCEPT_PAGE_COLORS.brand,
            textDecoration: "underline",
          }}
        >
          Contact support
        </Link>
      ) : null}
      {config.action === "signin" ? (
        <Link
          href="/auth/signin"
          style={{
            display: "inline-block",
            padding: "10px 20px",
            borderRadius: 8,
            background: ACCEPT_PAGE_COLORS.brand,
            color: "#fff",
            fontSize: 14,
            fontWeight: 500,
            textDecoration: "none",
          }}
        >
          Sign in
        </Link>
      ) : null}
      {config.action === "switch" && onSwitchAccount ? (
        <button
          type="button"
          onClick={onSwitchAccount}
          style={{
            padding: "10px 20px",
            borderRadius: 8,
            border: `1px solid ${ACCEPT_PAGE_COLORS.border}`,
            background: ACCEPT_PAGE_COLORS.surface,
            fontSize: 14,
            fontWeight: 500,
            color: ACCEPT_PAGE_COLORS.text,
            cursor: "pointer",
          }}
        >
          Sign in with a different account
        </button>
      ) : null}
    </div>
  );
}

function getErrorConfig(
  errorType: AcceptErrorType,
  currentEmail?: string,
  invitedEmail?: string,
): { title: string; body: string; action: "support" | "signin" | "switch" | "none" } {
  switch (errorType) {
    case "expired":
      return {
        title: "Invitation expired",
        body: "This invitation is no longer valid. Ask the workspace owner to send a new one.",
        action: "support",
      };
    case "invalid":
      return {
        title: "Invalid invitation",
        body: "This link is not valid. It may have been copied incorrectly or already used.",
        action: "support",
      };
    case "accepted":
      return {
        title: "Already accepted",
        body: "This invitation has already been used. Sign in to access your workspace.",
        action: "signin",
      };
    case "mismatch":
      return {
        title: "Wrong account",
        body: `You're signed in with ${currentEmail ?? "another account"} but this invitation was sent to ${invitedEmail ?? "a different email"}.`,
        action: "switch",
      };
    default:
      return {
        title: "Something went wrong",
        body: "We couldn't verify this invitation. Please try again.",
        action: "support",
      };
  }
}
