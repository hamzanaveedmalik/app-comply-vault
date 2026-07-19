import type { DispositionSummary } from "~/lib/dashboard-types";
import { DashboardCard } from "~/components/dashboard/dashboard-card";

type DispositionsCardProps = {
  dispositions: DispositionSummary;
};

export function DispositionsCard({ dispositions }: DispositionsCardProps): React.JSX.Element {
  const rows = [
    { label: "Resolved", count: dispositions.resolved, color: "#177a4c" },
    { label: "Dismissed", count: dispositions.dismissed, color: "#8fa1ab" },
    { label: "Escalated", count: dispositions.escalated, color: "#c13a2a" },
  ];
  const max = Math.max(1, ...rows.map((r) => r.count));

  const trendLabel =
    dispositions.trending === "down"
      ? "trending down"
      : dispositions.trending === "up"
        ? "trending up"
        : "steady";

  return (
    <DashboardCard title="Dispositions · 30d">
      {rows.map((r) => (
        <div key={r.label} className="mb-[11px] grid grid-cols-[82px_1fr_28px] items-center gap-2.5">
          <span className="text-[11.5px] text-[#3f4b45]">{r.label}</span>
          <div className="h-1.5 overflow-hidden rounded-[3px] bg-[#eff1ef]">
            <div
              className="h-full rounded-[3px]"
              style={{ width: `${(r.count / max) * 100}%`, background: r.color }}
            />
          </div>
          <span className="text-right text-[11.5px] font-semibold tabular-nums text-[#141f19]">
            {r.count}
          </span>
        </div>
      ))}
      <div className="mt-[13px] border-t border-[#e6e8e6] pt-3 text-[11.5px] text-[#79837d]">
        False-positive rate <b className="text-[#141f19]">{dispositions.falsePositiveRate}%</b> ·{" "}
        {trendLabel}
      </div>
    </DashboardCard>
  );
}
