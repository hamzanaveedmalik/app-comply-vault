"use client";

import Link from "next/link";
import { cn } from "~/lib/utils";
import { DASHBOARD_RANGES, type DashboardRange } from "~/lib/dashboard-types";
import { dashboardType } from "~/lib/dashboard-typography";

type DashboardDateRangePickerProps = {
  activeRange: DashboardRange;
  className?: string;
};

const RANGE_LABELS: Record<DashboardRange, string> = {
  "30d": "Last 30 days",
  "90d": "Last 90 days",
  "12m": "Last 12 months",
};

/** Unified time-window control for dashboard cards and header. */
export function DashboardDateRangePicker({
  activeRange,
  className,
}: DashboardDateRangePickerProps): React.JSX.Element {
  return (
    <div
      className={cn(
        "flex rounded-[8px] border border-surface-border bg-white p-0.5",
        className,
      )}
      role="group"
      aria-label="Dashboard time range"
    >
      {DASHBOARD_RANGES.map((range) => {
        const active = range === activeRange;
        return (
          <Link
            key={range}
            href={`/dashboard?range=${range}`}
            scroll={false}
            aria-current={active ? "true" : undefined}
            title={RANGE_LABELS[range]}
            className={cn(
              "rounded-[6px] px-[11px] py-[5px] text-[12px] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active
                ? "bg-brand-dark font-semibold text-white"
                : "font-medium text-text-secondary hover:text-text-primary",
            )}
          >
            <span className="sr-only">{RANGE_LABELS[range]}</span>
            <span aria-hidden>{range}</span>
          </Link>
        );
      })}
    </div>
  );
}

export { RANGE_LABELS };
