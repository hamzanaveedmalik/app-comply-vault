import type { MeetingUiStatus } from "~/lib/dashboard-types";
import { cn } from "~/lib/utils";

const STYLES: Record<
  MeetingUiStatus,
  { bg: string; border: string; text: string; dot: string }
> = {
  review: {
    bg: "#FFF7ED",
    border: "rgba(249, 115, 22, 0.12)",
    text: "#C2410C",
    dot: "#F97316",
  },
  flagged: {
    bg: "#FEF2F2",
    border: "rgba(239, 68, 68, 0.12)",
    text: "#B91C1C",
    dot: "#EF4444",
  },
  finalized: {
    bg: "#E8F5EE",
    border: "rgba(17, 122, 75, 0.12)",
    text: "#0D5C38",
    dot: "#117A4B",
  },
  draft: {
    bg: "#F8FAFC",
    border: "rgba(148, 163, 184, 0.12)",
    text: "#64748B",
    dot: "#94A3B8",
  },
};

type DashboardStatusBadgeProps = {
  status: MeetingUiStatus;
  /** Override visible / aria label (e.g. Processing, In review) */
  label: string;
  /** Show spinner (upload/processing) */
  processing?: boolean;
  className?: string;
};

export function DashboardStatusBadge({
  status,
  label,
  processing = false,
  className,
}: DashboardStatusBadgeProps): React.JSX.Element {
  const s = STYLES[status];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-[20px] border px-2.5 py-[3px] text-[10.5px] font-semibold",
        className,
      )}
      style={{
        backgroundColor: s.bg,
        borderColor: s.border,
        color: s.text,
      }}
      aria-label={label}
    >
      {processing ? (
        <span
          className="h-1.5 w-1.5 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent"
          aria-hidden
        />
      ) : (
        <span
          className="h-1.5 w-1.5 shrink-0 rounded-full"
          style={{ backgroundColor: s.dot }}
          aria-hidden
        />
      )}
      {label}
    </span>
  );
}
