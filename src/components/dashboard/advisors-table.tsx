import Link from "next/link";
import type { AdvisorRow } from "~/lib/dashboard-types";
import { buildSparkline } from "~/lib/sparkline";
import { DashboardCard } from "~/components/dashboard/dashboard-card";
import { dashboardType } from "~/lib/dashboard-typography";
import { cn } from "~/lib/utils";

type AdvisorsTableProps = {
  advisors: AdvisorRow[];
  /** Range suffix for the activity column header, e.g. "90d" */
  rangeLabel: string;
};

function loadColor(openFlags: number): string {
  if (openFlags >= 5) return "#c13a2a";
  if (openFlags >= 1) return "#b26a12";
  return "#177a4c";
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[parts.length - 1]![0] ?? ""}`.toUpperCase();
}

const TH = cn(
  "px-[18px] py-2.5 border-b border-surface-border whitespace-nowrap",
  dashboardType.tableHeader,
);
const TD = "px-[18px] py-[11px] border-b border-surface-border whitespace-nowrap align-middle";

export function AdvisorsTable({ advisors, rangeLabel }: AdvisorsTableProps): React.JSX.Element {
  const dateFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });

  return (
    <DashboardCard
      title="Advisors"
      emphasized
      link={{ href: "/settings/workspace", label: "Manage team" }}
      bodyClassName="px-0 pb-0 pt-0"
    >
      {advisors.length === 0 ? (
        <div className="px-[18px] py-10 text-center text-[12.5px] text-[#79837d]">
          No advisors yet. Invite advisors to your workspace and their certification
          activity will appear here.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[12.5px]">
            <thead>
              <tr>
                <th className={`${TH} text-left`}>Advisor</th>
                <th className={`${TH} text-right`}>Certified</th>
                <th className={`${TH} text-right`}>Open flags</th>
                <th className={`${TH} text-right`}>Avg finalize</th>
                <th className={`${TH} text-left`}>Last activity</th>
                <th className={`${TH} text-left`}>Activity · {rangeLabel}</th>
                <th className={TH} />
              </tr>
            </thead>
            <tbody>
              {advisors.map((a) => {
                const spark = buildSparkline(a.trend, { width: 68, height: 18, pad: 2 });
                return (
                  <tr key={a.userId} className="group last:[&>td]:border-b-0 hover:bg-[#f8f9f8]">
                    <td className={`${TD} font-semibold text-[#141f19]`}>
                      <span className="inline-flex items-center gap-2.5">
                        <span className="relative flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#e9f4ee] text-[10px] font-bold text-[#177a4c]">
                          {initials(a.name)}
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={a.avatarUrl}
                            alt=""
                            loading="lazy"
                            className="absolute inset-0 h-full w-full object-cover"
                          />
                        </span>
                        {a.name}
                      </span>
                    </td>
                    <td className={`${TD} text-right font-semibold tabular-nums text-[#141f19]`}>
                      {a.certifiedCount}
                    </td>
                    <td
                      className={`${TD} text-right font-semibold tabular-nums ${a.openFlags === 0 ? "font-normal text-[#79837d]" : "text-[#141f19]"}`}
                    >
                      {a.openFlags}
                    </td>
                    <td className={`${TD} text-right tabular-nums text-[#3f4b45]`}>
                      {a.avgFinalizeDays === null ? "—" : `${a.avgFinalizeDays}d`}
                    </td>
                    <td className={`${TD} text-[#79837d]`}>
                      {a.lastActivity ? dateFmt.format(new Date(a.lastActivity)) : "—"}
                    </td>
                    <td className={TD}>
                      <svg width="72" height="22" viewBox="0 0 72 22" className="block">
                        {spark.line ? (
                          <path
                            d={spark.line}
                            fill="none"
                            stroke={loadColor(a.openFlags)}
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            transform="translate(2 2)"
                          />
                        ) : null}
                      </svg>
                    </td>
                    <td className={TD}>
                      <Link
                        href={`/interaction-log?advisor=${encodeURIComponent(a.name)}`}
                        className="text-[12px] font-semibold text-[#177a4c] opacity-0 transition group-hover:opacity-100"
                      >
                        Open
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </DashboardCard>
  );
}
