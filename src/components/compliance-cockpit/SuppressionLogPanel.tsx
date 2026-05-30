"use client";

import type { CockpitMetricsDto, SuppressionLogEntryDto } from "~/lib/firm-profile-types";
import { cn } from "~/lib/utils";

type SuppressionLogPanelProps = {
  metrics: CockpitMetricsDto;
  log: SuppressionLogEntryDto[];
  hasPendingToggle?: boolean;
};

export function SuppressionLogPanel({
  metrics,
  log,
  hasPendingToggle = false,
}: SuppressionLogPanelProps): React.JSX.Element {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg border border-surface-border bg-surface-card p-3">
          <div className="text-[10px] uppercase text-text-muted">Meetings reviewed</div>
          <div className="text-xl font-semibold text-text-primary">
            {metrics.meetingsReviewed30d}
          </div>
          {!metrics.hasMeetingsReviewed30d ? (
            <div className="mt-1 text-[10px] text-text-muted">
              No meetings reviewed in the last 30 days.
            </div>
          ) : null}
        </div>
        <div className="rounded-lg border border-surface-border bg-surface-card p-3">
          <div className="text-[10px] uppercase text-text-muted">Flags total</div>
          <div className="text-xl font-semibold text-text-primary">{metrics.flagsTotal30d}</div>
          <div className="mt-1 text-[10px] text-text-muted">Rolling 30 days</div>
        </div>
      </div>

      <div className="rounded-lg border border-surface-border bg-surface-card">
        <div className="flex items-center gap-2 border-b border-surface-border px-3 py-2">
          {hasPendingToggle ? (
            <span
              className="h-2 w-2 animate-pulse rounded-full bg-semantic-success"
              aria-hidden
            />
          ) : (
            <span className="h-2 w-2 rounded-full bg-surface-border" aria-hidden />
          )}
          <h3 className="text-[12px] font-semibold text-text-primary">Suppression log</h3>
        </div>
        <ul className="max-h-[420px] overflow-y-auto p-2">
          {log.length === 0 ? (
            <li className="px-2 py-4 text-center text-[11px] text-text-muted">No entries yet.</li>
          ) : (
            log.map((entry) => (
              <li
                key={entry.id}
                className={cn(
                  "mb-2 border-l-2 pl-2 text-[11px]",
                  entry.action === "ACTIVATED"
                    ? "border-l-semantic-success"
                    : "border-l-surface-border",
                )}
              >
                <div className="font-medium text-text-primary">{entry.categoryDisplayName}</div>
                <div className="text-text-muted">
                  {entry.action === "ACTIVATED" ? "Activated" : "Deactivated"} ·{" "}
                  {new Date(entry.createdAt).toLocaleString()}
                </div>
                {entry.evidenceSnapshot ? (
                  <div className="mt-0.5 text-text-secondary">{entry.evidenceSnapshot}</div>
                ) : null}
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
