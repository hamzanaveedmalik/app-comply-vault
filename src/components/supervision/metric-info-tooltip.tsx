"use client";

import { Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip";

type MetricInfoTooltipProps = {
  label: string;
  explanation: string;
};

/**
 * Compact info control next to a metric label. Stops click so parent links do not navigate.
 */
export function MetricInfoTooltip({
  label,
  explanation,
}: MetricInfoTooltipProps): React.JSX.Element {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={`About ${label}`}
          className="inline-flex shrink-0 rounded-sm text-text-muted transition hover:text-text-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
        >
          <Info className="size-3" aria-hidden />
        </button>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        className="max-w-[240px] text-left text-[11px] font-normal leading-snug"
      >
        {explanation}
      </TooltipContent>
    </Tooltip>
  );
}
