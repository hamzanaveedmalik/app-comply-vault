import Link from "next/link";
import type { PortfolioSupervisionSummary } from "~/lib/types";
import type { SupervisionFilterState } from "~/server/supervision/filters";
import { supervisionHref } from "~/server/supervision/filters";
import { SupervisionFilters } from "~/components/supervision/supervision-filters";

type SupervisionCommandCentreProps = {
  portfolio: PortfolioSupervisionSummary;
  filters: SupervisionFilterState;
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function trendLabel(trend: string): string {
  switch (trend) {
    case "increasing":
      return "Increasing";
    case "decreasing":
      return "Decreasing";
    case "stable":
      return "Stable";
    default:
      return "Insufficient data";
  }
}

export function SupervisionCommandCentre({
  portfolio,
  filters,
}: SupervisionCommandCentreProps): React.JSX.Element {
  const { counts, selectivityStatement, firms, patterns, filterOptions } =
    portfolio;

  const metrics: Array<{ label: string; value: number; href?: string }> = [
    { label: "Interactions processed", value: counts.totalProcessed },
    { label: "Cleared or deprioritised", value: counts.clearedOrDeprioritised },
    { label: "Routine samples", value: counts.routineSamples },
    {
      label: "Priority findings",
      value: counts.priorityFindings,
      href: supervisionHref("/priority-inbox", filters),
    },
    { label: "Held interactions", value: counts.heldInteractions },
    { label: "Open remediation", value: counts.openRemediation },
  ];

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <header className="space-y-2">
        <h1 className="text-[22px] font-semibold tracking-tight text-[#141f19]">
          Supervision Command Centre
        </h1>
        <p className="max-w-3xl text-[14px] leading-snug text-[#5f6b64]">
          Portfolio view of authorised firms. Counts are triage signals for human
          review — ComplyVault does not independently determine a violation.
        </p>
      </header>

      <SupervisionFilters
        filters={filters}
        firms={filterOptions.firms}
        advisers={filterOptions.advisers}
      />

      <section
        className="rounded-[12px] border border-[#e6e8e6] bg-white p-4 shadow-[0_1px_2px_rgba(20,31,25,0.04)]"
        aria-labelledby="selectivity-heading"
      >
        <h2 id="selectivity-heading" className="text-[14px] font-semibold text-[#141f19]">
          Selectivity
        </h2>
        <p className="mt-1 text-[18px] font-semibold leading-snug text-[#141f19]">
          {selectivityStatement}
        </p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {metrics.map((metric) => {
            const body = (
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
                  className="rounded-[8px] border border-[#eef0ee] bg-[#fafbfa] px-3 py-2 transition hover:border-[#cfe3d8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#177a4c]"
                >
                  {body}
                </Link>
              );
            }
            return (
              <div
                key={metric.label}
                className="rounded-[8px] border border-[#eef0ee] bg-[#fafbfa] px-3 py-2"
              >
                {body}
              </div>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="firms-heading" className="space-y-3">
        <h2 id="firms-heading" className="text-[14px] font-semibold text-[#141f19]">
          Firm supervision
        </h2>
        {firms.length === 0 ? (
          <div className="rounded-[12px] border border-dashed border-[#d7dbd7] bg-white px-4 py-8 text-center text-[13px] text-[#79837d]">
            No authorised firms with supervision data yet.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-[12px] border border-[#e6e8e6] bg-white">
            <table className="min-w-full border-collapse text-left text-[13px]">
              <thead className="border-b border-[#eef0ee] bg-[#fafbfa] text-[11px] uppercase tracking-[0.04em] text-[#79837d]">
                <tr>
                  <th className="px-3 py-2 font-medium">Firm</th>
                  <th className="px-3 py-2 font-medium">Processed</th>
                  <th className="px-3 py-2 font-medium">Priority</th>
                  <th className="px-3 py-2 font-medium">Open remediation</th>
                  <th className="px-3 py-2 font-medium">Oldest unresolved</th>
                  <th className="px-3 py-2 font-medium">Top control</th>
                  <th className="px-3 py-2 font-medium">Trend</th>
                  <th className="px-3 py-2 font-medium">Coverage</th>
                </tr>
              </thead>
              <tbody>
                {firms.map((firm) => (
                  <tr key={firm.firmId} className="border-b border-[#f3f4f3] last:border-0">
                    <td className="px-3 py-2.5">
                      <Link
                        href={firm.href}
                        className="font-medium text-[#177a4c] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#177a4c]"
                      >
                        {firm.firmName}
                      </Link>
                    </td>
                    <td className="px-3 py-2.5 tabular-nums">{firm.processedInteractions}</td>
                    <td className="px-3 py-2.5 tabular-nums">{firm.priorityFindings}</td>
                    <td className="px-3 py-2.5 tabular-nums">{firm.openRemediation}</td>
                    <td className="px-3 py-2.5">{formatDate(firm.oldestUnresolvedFindingAt)}</td>
                    <td className="px-3 py-2.5">{firm.topControlConcern ?? "—"}</td>
                    <td className="px-3 py-2.5">{trendLabel(firm.trend)}</td>
                    <td className="px-3 py-2.5 capitalize">{firm.coverageStatus}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-labelledby="patterns-heading" className="space-y-3">
        <h2 id="patterns-heading" className="text-[14px] font-semibold text-[#141f19]">
          Emerging patterns
        </h2>
        {patterns.length === 0 ? (
          <div className="rounded-[12px] border border-dashed border-[#d7dbd7] bg-white px-4 py-6 text-[13px] text-[#79837d]">
            No material portfolio patterns in the current filter window.
          </div>
        ) : (
          <ul className="grid gap-3 md:grid-cols-3">
            {patterns.map((pattern) => (
              <li key={pattern.id}>
                <Link
                  href={pattern.href}
                  className="block h-full rounded-[12px] border border-[#e6e8e6] bg-white p-4 transition hover:border-[#cfe3d8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#177a4c]"
                >
                  <p className="text-[13px] font-semibold text-[#141f19]">{pattern.title}</p>
                  <p className="mt-2 text-[12.5px] leading-snug text-[#5f6b64]">
                    {pattern.summary}
                  </p>
                  <p className="mt-3 text-[11px] uppercase tracking-[0.04em] text-[#79837d]">
                    {pattern.firmsAffected} firms · {pattern.openFindings} open
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
