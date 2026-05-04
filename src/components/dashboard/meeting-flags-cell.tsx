import { Flag, Check } from "lucide-react";
import { dashboardColors } from "~/lib/dashboard-colors";

type MeetingFlagsCellProps = {
  flagCount: number;
};

export function MeetingFlagsCell({ flagCount }: MeetingFlagsCellProps): React.JSX.Element {
  if (flagCount === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-[13px] font-medium text-brand">
        <Check className="h-3.5 w-3.5 shrink-0" strokeWidth={2.5} aria-hidden />
        Clean
      </span>
    );
  }

  const colorClass = flagCount >= 5 ? "text-semantic-danger" : "text-semantic-warning";
  const stroke = flagCount >= 5 ? dashboardColors.semanticDanger : dashboardColors.semanticWarning;

  return (
    <span className={`inline-flex items-center gap-1 text-[13px] font-semibold ${colorClass}`}>
      <Flag className="h-3.5 w-3.5 shrink-0" style={{ stroke }} aria-hidden />
      {flagCount}
    </span>
  );
}
