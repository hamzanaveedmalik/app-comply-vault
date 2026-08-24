// Tremor BarList [v1.0.0] — adapted for ComplyVault semantic tokens
// Source: https://github.com/tremorlabs/tremor (Apache-2.0)
// Commit: main @ 2026-03-20

"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "~/lib/utils";
import { dashboardType } from "~/lib/dashboard-typography";

export type BarListItem<T = Record<string, unknown>> = T & {
  key?: string;
  href?: string;
  value: number;
  name: string;
  barColor?: string;
};

export type BarListProps<T = Record<string, unknown>> = React.HTMLAttributes<HTMLDivElement> & {
  data: BarListItem<T>[];
  valueFormatter?: (value: number) => string;
  onValueChange?: (payload: BarListItem<T>) => void;
  sortOrder?: "ascending" | "descending" | "none";
};

export function BarList<T extends Record<string, unknown> = Record<string, unknown>>({
  data = [],
  valueFormatter = (value) => value.toLocaleString(),
  onValueChange,
  sortOrder = "descending",
  className,
  ...props
}: BarListProps<T>): React.JSX.Element {
  const sortedData = React.useMemo(() => {
    if (sortOrder === "none") return data;
    return [...data].sort((a, b) =>
      sortOrder === "ascending" ? a.value - b.value : b.value - a.value,
    );
  }, [data, sortOrder]);

  const widths = React.useMemo(() => {
    const maxValue = Math.max(...sortedData.map((item) => item.value), 0);
    return sortedData.map((item) =>
      item.value === 0 ? 0 : Math.max((item.value / maxValue) * 100, 2),
    );
  }, [sortedData]);

  const rowHeight = "h-8";

  return (
    <div className={cn("flex justify-between space-x-6", className)} {...props}>
      <div className="relative w-full space-y-1.5">
        {sortedData.map((item, index) => {
          const Wrapper = onValueChange ? "button" : "div";
          return (
            <Wrapper
              key={item.key ?? item.name}
              type={onValueChange ? "button" : undefined}
              onClick={onValueChange ? () => onValueChange(item) : undefined}
              className={cn(
                "group w-full rounded-sm text-left",
                onValueChange && "cursor-pointer hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              )}
            >
              <div className={cn("flex items-center rounded-sm transition-all", rowHeight)}>
                <div
                  className={cn(
                    "absolute flex max-w-full items-center rounded-sm transition-all",
                    rowHeight,
                  )}
                  style={{
                    width: `${widths[index]}%`,
                    backgroundColor: item.barColor ?? "var(--chart-cleared)",
                  }}
                />
                <div
                  className={cn(
                    "relative flex w-full items-center justify-between space-x-2 px-2",
                    rowHeight,
                  )}
                >
                  {item.href ? (
                    <Link
                      href={item.href}
                      className={cn(dashboardType.caption, "truncate hover:underline")}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {item.name}
                    </Link>
                  ) : (
                    <p className={cn(dashboardType.caption, "truncate text-text-primary")}>
                      {item.name}
                    </p>
                  )}
                </div>
              </div>
            </Wrapper>
          );
        })}
      </div>
      <div>
        {sortedData.map((item) => (
          <div
            key={item.key ?? item.name}
            className={cn(
              "flex items-center justify-end",
              rowHeight,
              dashboardType.badgeCount,
              "text-text-primary",
            )}
          >
            {valueFormatter(item.value)}
          </div>
        ))}
      </div>
    </div>
  );
}
