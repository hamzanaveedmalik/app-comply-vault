import dynamic from "next/dynamic";
import type { SupervisionSummary } from "~/lib/types";

const SelectivityMetrics = dynamic(
  () =>
    import("~/components/dashboard/selectivity-metrics").then((m) => m.SelectivityMetrics),
  {
    loading: () => (
      <section
        className="rounded-[12px] border border-[#e6e8e6] bg-white p-4 shadow-[0_1px_2px_rgba(20,31,25,0.04)]"
        aria-busy="true"
        aria-label="Loading supervision metrics"
      >
        <div className="h-16 animate-pulse rounded bg-[#f1f5f3]" />
      </section>
    ),
  },
);

type SelectivityCardProps = {
  summary: SupervisionSummary;
};

export function SelectivityCard({ summary }: SelectivityCardProps): React.JSX.Element {
  return <SelectivityMetrics summary={summary} />;
}
