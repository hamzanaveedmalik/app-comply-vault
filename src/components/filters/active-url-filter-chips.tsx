"use client";

import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";

const FILTER_LABELS: Record<string, string> = {
  clientName: "Client",
  status: "Status",
  dateFrom: "From",
  dateTo: "To",
  outcome: "Outcome",
};

type ActiveUrlFilterChipsProps = {
  filters: Record<string, string>;
  basePath: string;
  /** Keys to surface as chips; empty values are skipped */
  keys: string[];
};

export function ActiveUrlFilterChips({
  filters,
  basePath,
  keys,
}: ActiveUrlFilterChipsProps): React.JSX.Element | null {
  const router = useRouter();
  const active = keys.filter((key) => filters[key] && filters[key] !== "all");

  if (active.length === 0) return null;

  const dismiss = (key: string): void => {
    const next = { ...filters, [key]: "" };
    const params = new URLSearchParams();
    Object.entries(next).forEach(([k, v]) => {
      if (v && v !== "all") params.set(k, v);
    });
    const qs = params.toString();
    router.push(qs ? `${basePath}?${qs}` : basePath);
  };

  return (
    <div className="mb-3 flex flex-wrap items-center gap-2" aria-label="Active filters">
      {active.map((key) => (
        <Badge key={key} variant="secondary" className="gap-1 pr-1 font-normal">
          <span>
            {FILTER_LABELS[key] ?? key}: {filters[key]}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-4 w-4"
            aria-label={`Remove ${FILTER_LABELS[key] ?? key} filter`}
            onClick={() => dismiss(key)}
          >
            <X className="h-3 w-3" aria-hidden />
          </Button>
        </Badge>
      ))}
    </div>
  );
}
