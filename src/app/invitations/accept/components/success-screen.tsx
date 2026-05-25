import { ACCEPT_PAGE_COLORS, ACCEPT_PAGE_FONT } from "../types";
import { ROLE_CONFIG, type WorkspaceRoleKey } from "~/lib/role-config";

type SuccessScreenProps = {
  workspaceName: string;
  role: WorkspaceRoleKey;
};

export function SuccessScreen({ workspaceName, role }: SuccessScreenProps): React.ReactElement {
  const roleLabel = ROLE_CONFIG[role].label;

  return (
    <div
      style={{
        textAlign: "center",
        padding: "32px 16px",
        fontFamily: ACCEPT_PAGE_FONT,
      }}
      role="status"
      aria-live="polite"
    >
      <div
        style={{
          width: 48,
          height: 48,
          margin: "0 auto 16px",
          borderRadius: 10,
          background: ACCEPT_PAGE_COLORS.brandSubtle,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M5 13l4 4L19 7"
            stroke={ACCEPT_PAGE_COLORS.brand}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
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
        You&apos;ve joined {workspaceName}
      </h1>
      <p style={{ margin: "0 0 8px", fontSize: 14, color: ACCEPT_PAGE_COLORS.textSecondary }}>
        Signed in as {roleLabel}.
      </p>
      <p style={{ margin: 0, fontSize: 13, color: ACCEPT_PAGE_COLORS.textTertiary }}>
        Redirecting to dashboard…
      </p>
    </div>
  );
}
