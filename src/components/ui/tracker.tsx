// Tremor Tracker [v1.0.0] — adapted for ComplyVault semantic tokens
// Source: https://github.com/tremorlabs/tremor (Apache-2.0)
// Commit: main @ 2026-03-20

"use client";

import * as React from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { cn } from "~/lib/utils";

export type TrackerBlockProps = {
  key?: string | number;
  color?: string;
  tooltip?: string;
  hoverEffect?: boolean;
  defaultBackgroundColor?: string;
};

type TrackerBlockInternalProps = TrackerBlockProps & {
  defaultBackgroundColor: string;
  hoverEffect: boolean;
};

function Block({
  color,
  tooltip,
  defaultBackgroundColor,
  hoverEffect,
}: TrackerBlockInternalProps): React.JSX.Element {
  const block = (
    <span
      className={cn(
        "h-full flex-1 rounded-sm transition-opacity",
        hoverEffect && "hover:opacity-80",
      )}
      style={{ backgroundColor: color ?? defaultBackgroundColor }}
    />
  );

  if (!tooltip) {
    return block;
  }

  return (
    <TooltipProvider delayDuration={0}>
      <Tooltip>
        <TooltipTrigger asChild>{block}</TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          {tooltip}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export type TrackerProps = React.HTMLAttributes<HTMLDivElement> & {
  data: TrackerBlockProps[];
  defaultBackgroundColor?: string;
  hoverEffect?: boolean;
};

export function Tracker({
  data = [],
  defaultBackgroundColor = "var(--chart-opened)",
  hoverEffect = false,
  className,
  ...props
}: TrackerProps): React.JSX.Element {
  return (
    <div
      className={cn("flex h-2 w-full gap-0.5 overflow-hidden rounded-sm", className)}
      {...props}
    >
      {data.map((blockProps, index) => (
        <Block
          key={blockProps.key ?? index}
          {...blockProps}
          defaultBackgroundColor={defaultBackgroundColor}
          hoverEffect={hoverEffect}
        />
      ))}
    </div>
  );
}
