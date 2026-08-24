"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Download, RotateCcw } from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { TextShimmer } from "~/components/ui/text-shimmer";
import { cn } from "~/lib/utils";
import { dashboardType } from "~/lib/dashboard-typography";
import {
  buildFilterHref,
  countRecords,
  type ChartDataRow,
  type ChartFilterParam,
  type ChartSeriesConfig,
} from "~/lib/chart-frame-types";
import { useReducedMotion } from "~/hooks/use-reduced-motion";

const TOOLTIP_OPEN_DELAY_MS = 60;
const LOW_N_THRESHOLD = 25;

export type ChartFrameState =
  | { kind: "loading" }
  | { kind: "empty"; message: string }
  | { kind: "error"; queryName: string; onRetry?: () => void }
  | { kind: "ready" };

export type ChartFrameProps = {
  title: string;
  periodLabel?: string;
  headerAction?: React.ReactNode;
  state: ChartFrameState;
  rows: ChartDataRow[];
  series: ChartSeriesConfig[];
  chartKind: "time-series" | "categorical";
  /** Fixed height for chart area — prevents layout shift while loading */
  chartHeight?: number;
  workspaceHash?: string;
  children: (ctx: ChartFrameRenderContext) => React.ReactNode;
  className?: string;
  /** Optional low-n override; below threshold shows record list instead of chart */
  lowNThreshold?: number;
};

export type ChartFrameRenderContext = {
  focusedIndex: number | null;
  setFocusedIndex: (index: number | null) => void;
  onActivate: (rowIndex: number, seriesKey?: string) => void;
  tooltipOpenDelay: number;
  reduceMotion: boolean;
};

export function ChartFrame({
  title,
  periodLabel,
  headerAction,
  state,
  rows,
  series,
  chartKind,
  chartHeight = 120,
  workspaceHash,
  children,
  className,
  lowNThreshold = LOW_N_THRESHOLD,
}: ChartFrameProps): React.JSX.Element {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const [focusedIndex, setFocusedIndex] = React.useState<number | null>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const totalRecords = countRecords(rows);
  const isLowN = state.kind === "ready" && totalRecords > 0 && totalRecords < lowNThreshold;

  const onActivate = React.useCallback(
    (rowIndex: number, seriesKey?: string) => {
      const row = rows[rowIndex];
      if (!row) return;
      const filter =
        row.filter ??
        (seriesKey ? series.find((s) => s.key === seriesKey)?.filter : series[0]?.filter);
      if (!filter) return;
      router.push(buildFilterHref(filter));
    },
    [rows, series, router],
  );

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>): void => {
    if (state.kind !== "ready" || rows.length === 0) return;

    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      setFocusedIndex((prev) => {
        const next = prev === null ? 0 : Math.min(prev + 1, rows.length - 1);
        return next;
      });
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      setFocusedIndex((prev) => {
        const next = prev === null ? 0 : Math.max(prev - 1, 0);
        return next;
      });
    } else if (event.key === "Enter" && focusedIndex !== null) {
      event.preventDefault();
      onActivate(focusedIndex);
    } else if (event.key === "Escape") {
      event.preventDefault();
      setFocusedIndex(null);
    }
  };

  const exportEvidence = (): void => {
    const payload = {
      title,
      periodLabel,
      generatedAt: new Date().toISOString(),
      workspaceHash: workspaceHash ?? null,
      rows,
      series: series.map(({ key, label }) => ({ key, label })),
      recordIds: rows.flatMap((r) => r.recordIds ?? []),
      queryParameters: series.map((s) => s.filter.params),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `chart-evidence-${Date.now()}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const renderContext: ChartFrameRenderContext = {
    focusedIndex,
    setFocusedIndex,
    onActivate,
    tooltipOpenDelay: reduceMotion ? 0 : TOOLTIP_OPEN_DELAY_MS,
    reduceMotion,
  };

  return (
    <section className={cn("rounded-[10px] border border-surface-border bg-white shadow-sm", className)}>
      <div className="flex items-center justify-between gap-2 px-[18px] pt-4">
        <div className="min-w-0">
          <h3 className={dashboardType.cardTitle}>{title}</h3>
          {periodLabel ? (
            <p className={cn(dashboardType.caption, "mt-0.5")}>{periodLabel}</p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {headerAction}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Chart actions">
                <Download className="h-4 w-4" aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={exportEvidence}>Export as evidence</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="px-[18px] pb-[18px] pt-[14px]">
        {state.kind === "loading" ? (
          <div style={{ height: chartHeight }} className="flex items-center justify-center">
            <TextShimmer className={dashboardType.caption}>Loading chart data…</TextShimmer>
          </div>
        ) : null}

        {state.kind === "empty" ? (
          <div
            style={{ minHeight: chartHeight }}
            className="flex items-center justify-center text-center"
          >
            <p className={dashboardType.caption}>{state.message}</p>
          </div>
        ) : null}

        {state.kind === "error" ? (
          <div
            style={{ minHeight: chartHeight }}
            className="flex flex-col items-center justify-center gap-2 text-center"
          >
            <p className={dashboardType.caption}>
              Could not load <span className="font-medium text-text-primary">{state.queryName}</span>
            </p>
            {state.onRetry ? (
              <Button variant="outline" size="sm" onClick={state.onRetry}>
                <RotateCcw className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                Retry
              </Button>
            ) : null}
          </div>
        ) : null}

        {state.kind === "ready" && isLowN ? (
          <LowNRecordList rows={rows} series={series} onActivate={onActivate} />
        ) : null}

        {state.kind === "ready" && !isLowN ? (
          <div
            ref={containerRef}
            tabIndex={0}
            role="group"
            aria-label={`${title} chart. Use arrow keys to move between data points, Enter to open filtered records, Escape to clear selection.`}
            onKeyDown={handleKeyDown}
            className="rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            data-chart-kind={chartKind}
          >
            <div style={{ height: chartHeight }}>{children(renderContext)}</div>
          </div>
        ) : null}

        <ChartDataTable rows={rows} series={series} />
      </div>
    </section>
  );
}

type LowNRecordListProps = {
  rows: ChartDataRow[];
  series: ChartSeriesConfig[];
  onActivate: (rowIndex: number, seriesKey?: string) => void;
};

function LowNRecordList({ rows, series, onActivate }: LowNRecordListProps): React.JSX.Element {
  return (
    <ul className="space-y-1.5" aria-label="Record list (small sample)">
      {rows.map((row, rowIndex) => (
        <li key={row.label}>
          <button
            type="button"
            className="flex w-full items-center justify-between rounded-md border border-surface-border px-3 py-2 text-left hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => onActivate(rowIndex)}
          >
            <span className={dashboardType.caption}>{row.label}</span>
            <span className="flex gap-3">
              {series.map((s) => (
                <span key={s.key} className={cn(dashboardType.badgeCount, "text-text-primary")}>
                  {s.label}: {(row.values[s.key] ?? 0).toLocaleString()}
                </span>
              ))}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

type ChartDataTableProps = {
  rows: ChartDataRow[];
  series: ChartSeriesConfig[];
};

function ChartDataTable({ rows, series }: ChartDataTableProps): React.JSX.Element | null {
  if (rows.length === 0) return null;

  return (
    <table className="sr-only">
      <caption>Chart data</caption>
      <thead>
        <tr>
          <th scope="col">Period</th>
          {series.map((s) => (
            <th key={s.key} scope="col">
              {s.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.label}>
            <th scope="row">{row.label}</th>
            {series.map((s) => (
              <td key={s.key}>{row.values[s.key] ?? 0}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export type ChartTooltipFrameProps = {
  label: string;
  items: Array<{ color: string; label: string; value: number }>;
  recordCount: number;
  className?: string;
};

export function ChartTooltipFrame({
  label,
  items,
  recordCount,
  className,
}: ChartTooltipFrameProps): React.JSX.Element {
  return (
    <div
      className={cn(
        "rounded-md border border-border/50 bg-popover px-2.5 py-1.5 text-xs shadow-md",
        className,
      )}
    >
      <p className="mb-1.5 font-medium text-foreground">{label}</p>
      <ul className="space-y-1">
        {items.map((item) => (
          <li key={item.label} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span
                className="h-2 w-2 shrink-0 rounded-[2px]"
                style={{ backgroundColor: item.color }}
                aria-hidden
              />
              {item.label}
            </span>
            <span className="tabular font-medium text-foreground">
              {item.value.toLocaleString()}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-1.5 border-t border-border/50 pt-1.5 text-muted-foreground">
        Click to view {recordCount.toLocaleString()} records
      </p>
    </div>
  );
}

export { LOW_N_THRESHOLD, TOOLTIP_OPEN_DELAY_MS };
export type { ChartFilterParam, ChartDataRow, ChartSeriesConfig };
