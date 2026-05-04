"use client";

import { useMemo, useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Sector } from "recharts";
import type { PieSectorDataItem } from "recharts";
import type { MeetingTypeData } from "~/lib/dashboard-types";
import { meetingTypeColor } from "~/lib/dashboard-colors";

type MeetingTypeDonutProps = {
  data: MeetingTypeData[];
  "aria-label"?: string;
};

const PAD_DEG = (0.04 * 180) / Math.PI;

type CellDatum = MeetingTypeData & { fill: string };

export function MeetingTypeDonut({
  data,
  "aria-label": ariaLabel,
}: MeetingTypeDonutProps): React.JSX.Element {
  const total = useMemo(() => data.reduce((s, d) => s + d.count, 0), [data]);

  if (total === 0) {
    return (
      <div
        className="flex h-full min-h-[160px] flex-col items-center justify-center rounded-[14px] border border-surface-border bg-surface-card p-4 shadow-[0_1px_4px_rgba(0,0,0,0.04)]"
        role="img"
        aria-label={ariaLabel ?? "No meetings by type"}
      >
        <p className="text-[13px] text-text-secondary">No meetings to chart yet</p>
      </div>
    );
  }
  const chartData = useMemo<CellDatum[]>(
    () =>
      data.map((d) => ({
        ...d,
        fill: meetingTypeColor(d.type),
      })),
    [data],
  );

  const [active, setActive] = useState<number | null>(null);

  const renderActiveShape = (props: PieSectorDataItem): React.JSX.Element => (
    <Sector {...props} outerRadius={(props.outerRadius ?? 0) + 4} />
  );

  return (
    <div
      className="flex h-full min-h-[160px] flex-row items-center gap-4 rounded-[14px] border border-surface-border bg-surface-card p-4 shadow-[0_1px_4px_rgba(0,0,0,0.04)]"
      role="img"
      aria-label={ariaLabelFor(total, ariaLabel)}
    >
      <div className="relative h-[120px] w-[120px] shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
            <Pie
              data={chartData}
              dataKey="count"
              nameKey="type"
              cx="50%"
              cy="50%"
              innerRadius={29}
              outerRadius={43}
              paddingAngle={PAD_DEG}
              onMouseEnter={(_, i) => setActive(i)}
              onMouseLeave={() => setActive(null)}
              activeShape={renderActiveShape}
            >
              {chartData.map((entry, i) => (
                <Cell
                  key={entry.type}
                  fill={entry.fill}
                  opacity={active === null || active === i ? 1 : 0.3}
                  className="transition-opacity duration-200"
                />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center pt-1">
          <span className="text-[18px] font-bold text-text-primary">{total}</span>
          <span className="text-[8px] font-medium uppercase text-text-muted">Total</span>
        </div>
      </div>
      <ul className="min-w-0 flex-1 space-y-2">
        {chartData.map((row, i) => {
          const dim = active !== null && active !== i ? "opacity-30" : "opacity-100";
          return (
            <li key={row.type}>
              <button
                type="button"
                className={`flex w-full cursor-pointer items-center gap-2 rounded-md px-1 py-0.5 text-left transition-opacity duration-200 ${dim}`}
                onMouseEnter={() => setActive(i)}
                onMouseLeave={() => setActive(null)}
              >
                <span
                  className="h-[7px] w-[7px] shrink-0 rounded-[2px]"
                  style={{ backgroundColor: row.fill }}
                  aria-hidden
                />
                <span className="min-w-0 flex-1 truncate text-[10.5px] font-medium text-text-secondary">
                  {row.type}
                </span>
                <span className="text-[10.5px] font-bold text-text-primary">{row.count}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ariaLabelFor(total: number, ariaLabel?: string): string {
  return ariaLabel ?? `Meetings by type, ${total} total`;
}
