import { cn } from "~/lib/utils";

export type PresenceStatus = "online" | "away" | "offline";

export type StatusDotProps = {
  status: PresenceStatus;
  className?: string;
};

const statusToVar: Record<PresenceStatus, string> = {
  online: "var(--color-status-online)",
  away: "var(--color-status-away)",
  offline: "var(--color-status-offline)",
};

/**
 * 9×9 presence indicator with sidebar-surface ring (workspace dropdown team rows).
 */
export function StatusDot({ status, className }: StatusDotProps): React.JSX.Element {
  return (
    <span
      className={cn(
        "absolute -bottom-px -right-px h-[9px] w-[9px] rounded-full border-2 border-sidebar-surface",
        className,
      )}
      style={{ backgroundColor: statusToVar[status] }}
      aria-label={status}
    />
  );
}
