import dynamic from "next/dynamic";
import type { FlagActivityWeek } from "~/lib/dashboard-types";
import { DashboardCard, Metric } from "~/components/dashboard/dashboard-card";

const FlagActivityChartClient = dynamic(
  () => import("./flag-activity-chart").then((m) => m.FlagActivityChart),
  {
    loading: () => (
      <DashboardCard title="Flag Activity">
        <Metric value="—" unit="open" />
        <div className="mt-3 h-[140px] animate-pulse rounded bg-surface-divider" aria-busy="true" />
      </DashboardCard>
    ),
  },
);

type FlagActivityCardProps = {
  data: FlagActivityWeek[];
  openFlags: number;
  openedDelta: number;
  rangeLabel: string;
};

/** Server-friendly wrapper — chart/Recharts load client-side only. */
export function FlagActivityCard(props: FlagActivityCardProps): React.JSX.Element {
  return <FlagActivityChartClient {...props} />;
}
