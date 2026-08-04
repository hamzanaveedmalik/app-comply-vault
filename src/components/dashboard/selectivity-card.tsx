import Link from "next/link";
import type { SupervisionSummary } from "~/lib/types";

type SelectivityCardProps = {
  summary: SupervisionSummary;
};

export function SelectivityCard({ summary }: SelectivityCardProps): React.JSX.Element {
  const { counts, selectivityStatement } = summary;

  const metrics: Array<{ label: string; value: number; href?: string }> = [
    {
      label: "Processed",
      value: counts.totalProcessed,
      href: "/interaction-log",
    },
    {
      label: "Cleared / deprioritised",
      value: counts.clearedOrDeprioritised,
      href: "/interaction-log?outcome=CLEARED",
    },
    {
      label: "Routine samples",
      value: counts.routineSamples,
      href: "/interaction-log?outcome=ROUTINE_SAMPLE",
    },
    {
      label: "Priority findings",
      value: counts.priorityFindings,
      href: "/interaction-log?outcome=ESCALATED",
    },
    {
      label: "Held",
      value: counts.heldInteractions,
      href: "/interaction-log?outcome=HELD",
    },
    {
      label: "Open remediation",
      value: counts.openRemediation,
    },
  ];

  return (
    <section
      className="rounded-[12px] border border-[#e6e8e6] bg-white p-4 shadow-[0_1px_2px_rgba(20,31,25,0.04)]"
      aria-labelledby="selectivity-heading"
    >
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 id="selectivity-heading" className="text-[14px] font-semibold text-[#141f19]">
            Supervision selectivity
          </h2>
          <p className="mt-1 text-[12.5px] leading-snug text-[#79837d]">{selectivityStatement}</p>
        </div>
        <Link
          href="/interaction-log"
          className="text-[12px] font-medium text-[#177a4c] hover:underline"
        >
          View interactions
        </Link>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {metrics.map((metric) => {
          const content = (
            <>
              <p className="text-[11px] font-medium uppercase tracking-[0.04em] text-[#79837d]">
                {metric.label}
              </p>
              <p className="mt-1 text-[20px] font-semibold tabular-nums text-[#141f19]">
                {metric.value}
              </p>
            </>
          );
          if (metric.href) {
            return (
              <Link
                key={metric.label}
                href={metric.href}
                className="rounded-[8px] border border-[#eef0ee] bg-[#fafbfa] px-3 py-2 transition hover:border-[#cfe3d8]"
              >
                {content}
              </Link>
            );
          }
          return (
            <div
              key={metric.label}
              className="rounded-[8px] border border-[#eef0ee] bg-[#fafbfa] px-3 py-2"
            >
              {content}
            </div>
          );
        })}
      </div>
    </section>
  );
}
