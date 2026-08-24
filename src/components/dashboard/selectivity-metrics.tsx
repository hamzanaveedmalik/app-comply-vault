"use client";

import Link from "next/link";
import { AnimatedNumber } from "~/components/ui/animated-number";
import { dashboardType } from "~/lib/dashboard-typography";
import type { SupervisionSummary } from "~/lib/types";
import { cn } from "~/lib/utils";

type SelectivityMetricsProps = {
  summary: SupervisionSummary;
};

export function SelectivityMetrics({ summary }: SelectivityMetricsProps): React.JSX.Element {
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
      className="rounded-[12px] border border-surface-border bg-white p-4 shadow-sm"
      aria-labelledby="selectivity-heading"
    >
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 id="selectivity-heading" className={dashboardType.cardTitleEmphasis}>
            Supervision selectivity
          </h2>
          <p className={cn(dashboardType.caption, "mt-1 leading-snug")}>{selectivityStatement}</p>
        </div>
        <Link href="/interaction-log" className={dashboardType.cardLink}>
          View interactions
        </Link>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {metrics.map((metric) => {
          const content = (
            <>
              <p className={dashboardType.metricLabel}>{metric.label}</p>
              <p className={cn(dashboardType.displayFigureSm, "mt-1")}>
                <AnimatedNumber value={metric.value} startOnView={false} />
              </p>
            </>
          );
          if (metric.href) {
            return (
              <Link
                key={metric.label}
                href={metric.href}
                className="rounded-[8px] border border-surface-divider bg-surface-muted px-3 py-2 transition hover:border-brand/30"
              >
                {content}
              </Link>
            );
          }
          return (
            <div
              key={metric.label}
              className="rounded-[8px] border border-surface-divider bg-surface-muted px-3 py-2"
            >
              {content}
            </div>
          );
        })}
      </div>
    </section>
  );
}
