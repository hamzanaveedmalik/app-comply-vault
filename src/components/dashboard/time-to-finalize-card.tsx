import type { FinalizeStrip } from "~/lib/dashboard-types";
import { DashboardCard, Metric } from "~/components/dashboard/dashboard-card";
import { dashboardType } from "~/lib/dashboard-typography";
import { cn } from "~/lib/utils";

type TimeToFinalizeCardProps = {
  strip: FinalizeStrip;
  avgDays: number | null;
};

export function TimeToFinalizeCard({ strip, avgDays }: TimeToFinalizeCardProps): React.JSX.Element {
  const max = strip.maxDays || 1;
  const clampPct = (pct: number): number => Math.max(2, Math.min(96, pct));
  const targetLeft = clampPct((strip.targetDays / max) * 100);
  const displayAvg = avgDays === null ? "—" : Math.round(avgDays * 10) / 10;

  return (
    <DashboardCard title="Time to Finalize" link={{ href: "/audit-packs", label: "By meeting" }}>
      <Metric value={displayAvg} unit={`days avg · target ≤ ${strip.targetDays}d`} />
      <div className="relative mt-3 h-[42px]">
        <div className="absolute left-0 right-0 top-[19px] h-0.5 rounded-[1px] bg-surface-divider" />
        <div
          className="absolute top-[7px] h-[26px] w-[1.5px] bg-text-primary opacity-40"
          style={{ left: `${targetLeft}%` }}
        />
        <div
          className={cn("absolute top-[34px] -translate-x-1/2", dashboardType.axisTick)}
          style={{ left: `${targetLeft}%` }}
        >
          {strip.targetDays}d
        </div>
        {strip.points.length === 0 ? (
          <div className={cn("absolute left-1/2 top-[6px] -translate-x-1/2", dashboardType.caption)}>
            No finalized meetings yet
          </div>
        ) : (
          strip.points.map((p, i) => (
            <div
              key={`${p.meetingId}-${i}`}
              title={`${p.clientName} · ${p.days}d`}
              className="absolute top-[15px] h-[9px] w-[9px] rounded-full border-2 border-white shadow-[0_0_0_1px_#d5d9d5]"
              style={{
                left: `${clampPct((p.days / max) * 100)}%`,
                background: p.late ? "var(--chart-breach)" : "var(--color-text-secondary)",
              }}
            />
          ))
        )}
        <div className={cn("absolute top-[34px] right-0", dashboardType.axisTick)}>
          {strip.maxDays}d
        </div>
      </div>
    </DashboardCard>
  );
}
