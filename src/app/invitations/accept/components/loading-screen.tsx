import { ACCEPT_PAGE_COLORS, ACCEPT_PAGE_FONT } from "../types";

export function LoadingScreen(): React.ReactElement {
  return (
    <div
      style={{
        textAlign: "center",
        padding: "48px 24px",
        fontFamily: ACCEPT_PAGE_FONT,
      }}
    >
      <div
        role="status"
        aria-live="polite"
        style={{
          width: 32,
          height: 32,
          margin: "0 auto 16px",
          border: `3px solid ${ACCEPT_PAGE_COLORS.border}`,
          borderTopColor: ACCEPT_PAGE_COLORS.brand,
          borderRadius: "50%",
          animation: "spin 0.8s linear infinite",
        }}
      />
      <p style={{ margin: 0, fontSize: 15, color: ACCEPT_PAGE_COLORS.textSecondary }}>
        Verifying invitation…
      </p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
