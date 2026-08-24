"use client";

import * as React from "react";
import Link from "next/link";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  type ChartConfig,
} from "~/components/ui/chart";
import {
  ChartFrame,
  ChartTooltipFrame,
  type ChartFrameRenderContext,
} from "~/components/charts/ChartFrame";
import { Metric } from "~/components/dashboard/dashboard-card";
import { dashboardType } from "~/lib/dashboard-typography";
import { chartColors } from "~/lib/chart-colors";
import type { ChartDataRow, ChartSeriesConfig } from "~/lib/chart-frame-types";
import type { FlagActivityWeek } from "~/lib/dashboard-types";
import { Tracker } from "~/components/ui/tracker";
import { cn } from "~/lib/utils";

type FlagActivityChartProps = {
  data: FlagActivityWeek[];
  openFlags: number;
  openedDelta: number;
  rangeLabel: string;
};

const SERIES: ChartSeriesConfig[] = [
  {
    key: "opened",
    label: "Opened",
    color: chartColors.opened,
    filter: { href: "/review", params: { status: "DRAFT_READY" } },
  },
  {
    key: "resolved",
    label: "Resolved",
    color: chartColors.resolved,
    filter: { href: "/review", params: { status: "FINALIZED" } },
  },
];

const chartConfig = {
  opened: { label: "Opened", color: chartColors.opened },
  resolved: { label: "Resolved", color: chartColors.resolved },
} satisfies ChartConfig;

function toRows(data: FlagActivityWeek[]): ChartDataRow[] {
  return data.map((d) => ({
    label: d.week,
    values: { opened: d.opened, resolved: d.resolved },
  }));
}

export function FlagActivityChart({
  data,
  openFlags,
  openedDelta,
  rangeLabel,
}: FlagActivityChartProps): React.JSX.Element {
  const rows = toRows(data);
  const totalRecords = data.reduce((sum, d) => sum + d.opened + d.resolved, 0);

  const deltaText =
    openedDelta === 0
      ? "no change"
      : `${openedDelta > 0 ? "+" : ""}${openedDelta} latest`;

  const state =
    data.length === 0
      ? ({ kind: "empty", message: "Flag activity will appear once flags are opened or resolved." } as const)
      : ({ kind: "ready" } as const);

  return (
    <ChartFrame
      title="Flag Activity"
      periodLabel={rangeLabel}
      state={state}
      rows={rows}
      series={SERIES}
      chartKind="time-series"
      chartHeight={140}
      headerAction={
        <Link href="/review" className={dashboardType.cardLink}>
          View all
        </Link>
      }
    >
      {(ctx) => (
        <>
          <Metric
            value={openFlags}
            unit="open"
            delta={{ text: deltaText, tone: openedDelta > 0 ? "bad" : "good" }}
          />
          <FlagActivityBars rows={rows} ctx={ctx} totalRecords={totalRecords} />
          <div className="mt-3">
            <p className={dashboardType.metricLabel + " mb-1.5"}>Weekly volume strip</p>
            <Tracker
              data={rows.map((row) => {
                const opened = row.values.opened ?? 0;
                const resolved = row.values.resolved ?? 0;
                const total = opened + resolved;
                const ratio = total === 0 ? 0 : resolved / total;
                return {
                  tooltip: `${row.label}: ${opened} opened, ${resolved} resolved`,
                  color:
                    ratio >= 0.5 ? chartColors.resolved : opened > 0 ? chartColors.opened : chartColors.sampled,
                };
              })}
              hoverEffect
            />
          </div>
        </>
      )}
    </ChartFrame>
  );
}

type FlagActivityBarsProps = {
  rows: ChartDataRow[];
  ctx: ChartFrameRenderContext;
  totalRecords: number;
};

function FlagActivityBars({ rows, ctx, totalRecords }: FlagActivityBarsProps): React.JSX.Element {
  const chartData = rows.map((row) => ({
    week: row.label,
    opened: row.values.opened ?? 0,
    resolved: row.values.resolved ?? 0,
  }));

  return (
    <ChartContainer config={chartConfig} className="mt-3 aspect-auto h-[100px] w-full">
      <BarChart
        accessibilityLayer
        data={chartData}
        margin={{ top: 4, right: 4, left: 0, bottom: 0 }}
        onClick={(chartState) => {
          const index = chartState?.activeTooltipIndex;
          if (typeof index === "number") {
            ctx.onActivate(index);
          }
        }}
      >
        <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border/40" />
        <XAxis
          dataKey="week"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          interval="preserveStartEnd"
          tick={{ className: cn(dashboardType.axisTick, "fill-text-muted") }}
        />
        <YAxis hide />
        <ChartTooltip
          cursor={{ stroke: "var(--border)", strokeWidth: 1 }}
          isAnimationActive={false}
          animationDuration={ctx.reduceMotion ? 0 : undefined}
          wrapperStyle={{ outline: "none" }}
          content={({ active, payload, label }) => {
            if (!active || !payload?.length || label == null) return null;
            return (
              <ChartTooltipFrame
                label={String(label)}
                items={payload.map((p) => ({
                  color: String(p.color ?? chartColors.opened),
                  label: String(p.name ?? p.dataKey),
                  value: Number(p.value ?? 0),
                }))}
                recordCount={
                  payload.reduce((sum, p) => sum + Number(p.value ?? 0), 0) || totalRecords
                }
              />
            );
          }}
        />
        <Bar
          dataKey="opened"
          fill="var(--color-opened)"
          radius={[2, 2, 0, 0]}
          isAnimationActive={false}
        />
        <Bar
          dataKey="resolved"
          fill="var(--color-resolved)"
          radius={[2, 2, 0, 0]}
          isAnimationActive={false}
        />
      </BarChart>
    </ChartContainer>
  );
}
