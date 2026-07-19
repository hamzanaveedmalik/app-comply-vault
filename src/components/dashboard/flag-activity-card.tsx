import type { FlagActivityWeek } from "~/lib/dashboard-types";
import { DashboardCard, Metric } from "~/components/dashboard/dashboard-card";

type FlagActivityCardProps = {
  data: FlagActivityWeek[];
  openFlags: number;
  openedDelta: number;
};

const BASELINE = 80;
const TOP = 6;
const GROUP_W = 40;
const BAR_W = 13;

export function FlagActivityCard({
  data,
  openFlags,
  openedDelta,
}: FlagActivityCardProps): React.JSX.Element {
  const max = Math.max(1, ...data.flatMap((d) => [d.opened, d.resolved]));
  const scale = (BASELINE - TOP) / max;

  const deltaText =
    openedDelta === 0
      ? "no change"
      : `${openedDelta > 0 ? "+" : ""}${openedDelta} this week`;

  return (
    <DashboardCard title="Flag Activity" link={{ href: "/review", label: "View all" }}>
      <Metric
        value={openFlags}
        unit="open"
        delta={{ text: deltaText, tone: openedDelta > 0 ? "bad" : "good" }}
      />
      <svg
        width="100%"
        height="96"
        viewBox="0 0 320 96"
        preserveAspectRatio="none"
        className="mt-3"
      >
        <line x1="0" y1="24" x2="320" y2="24" stroke="#eff1ef" strokeWidth="1" />
        <line x1="0" y1="52" x2="320" y2="52" stroke="#eff1ef" strokeWidth="1" />
        <line x1="0" y1={BASELINE} x2="320" y2={BASELINE} stroke="#e6e8e6" strokeWidth="1" />
        {data.map((d, i) => {
          const groupX = i * GROUP_W + 4;
          const openedH = d.opened * scale;
          const resolvedH = d.resolved * scale;
          return (
            <g key={d.week}>
              <rect
                x={groupX}
                y={BASELINE - openedH}
                width={BAR_W}
                height={openedH}
                rx="2.5"
                fill="#8fa1ab"
              />
              <rect
                x={groupX + BAR_W + 2}
                y={BASELINE - resolvedH}
                width={BAR_W}
                height={resolvedH}
                rx="2.5"
                fill="#177a4c"
              />
            </g>
          );
        })}
      </svg>
      <div className="mt-1 flex justify-between text-[10px] tabular-nums text-[#79837d]">
        <span>W1</span>
        <span>W3</span>
        <span>W5</span>
        <span>W8</span>
      </div>
      <div className="mt-2.5 flex gap-3.5">
        <div className="flex items-center gap-1.5 text-[11px] text-[#3f4b45]">
          <span className="h-2 w-2 rounded-[2px] bg-[#8fa1ab]" />
          Opened
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-[#3f4b45]">
          <span className="h-2 w-2 rounded-[2px] bg-[#177a4c]" />
          Resolved
        </div>
      </div>
    </DashboardCard>
  );
}
