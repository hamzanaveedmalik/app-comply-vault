import { AlertCircle } from "lucide-react";
import type { FlagAging } from "~/lib/dashboard-types";
import { DashboardCard, Metric } from "~/components/dashboard/dashboard-card";
import { dashboardType } from "~/lib/dashboard-typography";
import { cn } from "~/lib/utils";

type FlagAgingCardProps = {
  aging: FlagAging;
};

export function FlagAgingCard({ aging }: FlagAgingCardProps): React.JSX.Element {
  const total = aging.buckets.reduce((sum, b) => sum + b.count, 0);

  return (
    <DashboardCard title="Flag Aging">
      <Metric
        value={aging.avgDaysOpen === null ? "—" : aging.avgDaysOpen}
        unit="days avg open"
      />
      <div className="my-3 flex h-2 gap-0.5 overflow-hidden rounded-[4px]">
        {total === 0 ? (
          <div className="h-full flex-1 rounded-[2px] bg-surface-divider" />
        ) : (
          aging.buckets.map((b) =>
            b.count > 0 ? (
              <div
                key={b.label}
                className="rounded-[2px]"
                style={{ flexGrow: b.count, flexBasis: 0, background: b.color }}
              />
            ) : null,
          )
        )}
      </div>
      <div className="flex flex-wrap gap-3.5">
        {aging.buckets.map((b) => (
          <div key={b.label} className={cn("flex items-center gap-1.5", dashboardType.caption)}>
            <span className="h-2 w-2 rounded-[2px]" style={{ background: b.color }} aria-hidden />
            <b className="tabular font-semibold text-text-primary">{b.count}</b>
            {b.label}
          </div>
        ))}
      </div>
      {aging.pastSla > 0 ? (
        <div className="mt-3 flex items-center gap-1.5 border-t border-surface-border pt-3 text-[11.5px] font-semibold text-semantic-danger">
          <AlertCircle className="h-[13px] w-[13px] shrink-0" strokeWidth={2} aria-hidden />
          <span className="tabular">{aging.pastSla}</span> {aging.pastSla === 1 ? "flag" : "flags"}{" "}
          past SLA
        </div>
      ) : (
        <div className="mt-3 flex items-center gap-1.5 border-t border-surface-border pt-3 text-[11.5px] font-semibold text-brand">
          All flags within <span className="tabular">{aging.slaDays}</span>-day SLA
        </div>
      )}
    </DashboardCard>
  );
}
