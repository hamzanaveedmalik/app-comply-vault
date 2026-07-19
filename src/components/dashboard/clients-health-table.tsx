import Link from "next/link";
import type { ClientHealthRow } from "~/lib/dashboard-types";
import { buildSparkline } from "~/lib/sparkline";
import { DashboardCard } from "~/components/dashboard/dashboard-card";

type ClientsHealthTableProps = {
  clients: ClientHealthRow[];
};

function healthChip(score: number): { className: string; label: string } {
  if (score >= 75) return { className: "bg-[#e9f4ee] text-[#177a4c]", label: "healthy" };
  if (score >= 60) return { className: "bg-[#fdf4e6] text-[#b26a12]", label: "needs attention" };
  return { className: "bg-[#fcedeb] text-[#c13a2a]", label: "at risk" };
}

function sparkColor(score: number): string {
  if (score >= 75) return "#177a4c";
  if (score >= 60) return "#b26a12";
  return "#c13a2a";
}

const TH = "px-[18px] py-2.5 text-[10.5px] font-semibold uppercase tracking-[0.05em] text-[#79837d] border-b border-[#e6e8e6] whitespace-nowrap";
const TD = "px-[18px] py-[11px] border-b border-[#e6e8e6] whitespace-nowrap align-middle";

export function ClientsHealthTable({ clients }: ClientsHealthTableProps): React.JSX.Element {
  const dateFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });

  return (
    <DashboardCard
      title="Clients"
      emphasized
      link={{ href: "/interaction-log", label: "View all" }}
      bodyClassName="px-0 pb-0 pt-0"
    >
      {clients.length === 0 ? (
        <div className="px-[18px] py-10 text-center text-[12.5px] text-[#79837d]">
          No clients yet. Client health appears here once you upload meetings.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[12.5px]">
            <thead>
              <tr>
                <th className={`${TH} text-left`}>Client</th>
                <th className={`${TH} text-left`}>Health</th>
                <th className={`${TH} text-left`}>Coverage</th>
                <th className={`${TH} text-right`}>Open flags</th>
                <th className={`${TH} text-left`}>Last meeting</th>
                <th className={`${TH} text-left`}>Health · 8w</th>
                <th className={TH} />
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => {
                const chip = healthChip(c.health);
                const coveragePct =
                  c.coverageTotal === 0 ? 0 : (c.coverageDone / c.coverageTotal) * 100;
                const spark = buildSparkline(
                  c.trend.map((v) => -v),
                  { width: 68, height: 18, pad: 2 },
                );
                return (
                  <tr key={c.clientName} className="group last:[&>td]:border-b-0 hover:bg-[#f8f9f8]">
                    <td className={`${TD} font-semibold text-[#141f19]`}>{c.clientName}</td>
                    <td className={TD}>
                      <span
                        className={`inline-block min-w-[28px] rounded-[6px] px-0 py-[2.5px] text-center text-[11px] font-[650] tabular-nums ${chip.className}`}
                        title={`Health ${c.health} — ${chip.label}`}
                      >
                        {c.health}
                      </span>
                    </td>
                    <td className={TD}>
                      <div className="flex items-center gap-2">
                        <div className="h-[5px] w-16 overflow-hidden rounded-[3px] bg-[#eff1ef]">
                          <div
                            className="h-full rounded-[3px] bg-[#1c4a37]"
                            style={{ width: `${coveragePct}%` }}
                          />
                        </div>
                        <span className="text-[11.5px] tabular-nums text-[#3f4b45]">
                          {c.coverageDone}/{c.coverageTotal}
                        </span>
                      </div>
                    </td>
                    <td
                      className={`${TD} text-right font-semibold tabular-nums ${c.openFlags === 0 ? "font-normal text-[#79837d]" : "text-[#141f19]"}`}
                    >
                      {c.openFlags}
                    </td>
                    <td className={`${TD} text-[#79837d]`}>
                      {c.lastMeeting ? dateFmt.format(new Date(c.lastMeeting)) : "—"}
                    </td>
                    <td className={TD}>
                      <svg width="72" height="22" viewBox="0 0 72 22" className="block">
                        {spark.line ? (
                          <path
                            d={spark.line}
                            fill="none"
                            stroke={sparkColor(c.health)}
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
                        href={`/interaction-log?client=${encodeURIComponent(c.clientName)}`}
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
