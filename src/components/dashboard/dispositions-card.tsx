import { BarList } from "~/components/ui/bar-list";
import type { DispositionSummary } from "~/lib/dashboard-types";
import { DashboardCard } from "~/components/dashboard/dashboard-card";
import { dashboardType } from "~/lib/dashboard-typography";
import { chartColors } from "~/lib/chart-colors";

type DispositionsCardProps = {
  dispositions: DispositionSummary;
  rangeLabel: string;
};

export function DispositionsCard({
  dispositions,
  rangeLabel,
}: DispositionsCardProps): React.JSX.Element {
  const rows = [
    {
      name: "Resolved",
      value: dispositions.resolved,
      barColor: chartColors.cleared,
      href: "/interaction-log?outcome=CLEARED",
    },
    {
      name: "Dismissed",
      value: dispositions.dismissed,
      barColor: chartColors.sampled,
      href: "/interaction-log?finalized=true",
    },
    {
      name: "Escalated",
      value: dispositions.escalated,
      barColor: chartColors.breach,
      href: "/interaction-log?outcome=ESCALATED",
    },
  ];

  const trendLabel =
    dispositions.trending === "down"
      ? "trending down"
      : dispositions.trending === "up"
        ? "trending up"
        : "steady";

  return (
    <DashboardCard title={`Dispositions · ${rangeLabel}`}>
      <BarList data={rows} sortOrder="descending" />
      <div className={dashboardType.caption + " mt-[13px] border-t border-surface-border pt-3"}>
        False-positive rate{" "}
        <b className="tabular font-semibold text-text-primary">{dispositions.falsePositiveRate}%</b> ·{" "}
        {trendLabel}
      </div>
    </DashboardCard>
  );
}
