import Link from "next/link";
import { BarList } from "~/components/ui/bar-list";
import { ProgressCircle } from "~/components/ui/progress-circle";
import type { DashboardSummary } from "~/lib/dashboard-types";
import { buildSparkline } from "~/lib/sparkline";
import { DashboardCard } from "~/components/dashboard/dashboard-card";
import { dashboardType } from "~/lib/dashboard-typography";
import { chartColors } from "~/lib/chart-colors";
import { cn } from "~/lib/utils";

type ComplianceHealthCardProps = {
  score: number;
  label: string;
  delta: number;
  breakdown: DashboardSummary["healthBreakdown"];
  trend: DashboardSummary["healthTrend"];
  caption: string;
};

function progressVariant(score: number): "success" | "warning" | "error" {
  if (score <= 39) return "error";
  if (score <= 69) return "warning";
  return "success";
}

function statusBadge(score: number): { bg: string; text: string } {
  if (score <= 39) return { bg: "#FEE2E2", text: "#991B1B" };
  if (score <= 69) return { bg: "#FEF3C7", text: "#92400E" };
  return { bg: "#E8F5EE", text: "#0D5C38" };
}

function factorBarColor(value: number): string {
  if (value >= 70) return chartColors.cleared;
  if (value >= 40) return chartColors.priority;
  return chartColors.breach;
}

export function ComplianceHealthCard({
  score,
  label,
  delta,
  breakdown,
  trend,
  caption,
}: ComplianceHealthCardProps): React.JSX.Element {
  const badge = statusBadge(score);

  const factors = [
    { label: "Meeting coverage", value: breakdown.meetingCoverage },
    { label: "Docs finalized", value: breakdown.documentsFinalised },
    { label: "Flags resolved", value: breakdown.flagsResolved },
    { label: "Signatures", value: breakdown.signaturesComplete },
  ];

  const pointsLost = factors
    .map((f) => ({
      name: f.label,
      value: Math.max(0, 100 - f.value),
      barColor: factorBarColor(f.value),
    }))
    .filter((f) => f.value > 0);

  const spark = buildSparkline(
    trend.map((t) => t.score),
    { width: 320, height: 46, pad: 4 },
  );
  const axis = [0, 1, 2, 3].map((q) => trend[Math.floor((trend.length - 1) * (q / 3))]?.label ?? "");

  return (
    <DashboardCard title="Compliance Health" link={{ href: "/compliance-cockpit", label: "Details" }}>
      <div className="grid grid-cols-[auto_1fr] items-start gap-5">
        <div className="flex flex-col items-center gap-2">
          <ProgressCircle
            value={score}
            max={100}
            radius={42}
            strokeWidth={7}
            variant={progressVariant(score)}
            showAnimation={false}
          >
            <span className={dashboardType.displayFigureSm}>{score}</span>
          </ProgressCircle>
          <span
            className="max-w-[110px] truncate rounded-full px-2.5 py-0.5 text-center text-[10px] font-semibold leading-tight"
            style={{ backgroundColor: badge.bg, color: badge.text }}
            title={label}
          >
            {label}
          </span>
        </div>
        <div className="min-w-0">
          <p className={cn(dashboardType.metricLabel, "mb-2")}>Points lost by factor</p>
          {pointsLost.length === 0 ? (
            <p className={dashboardType.caption}>No points lost across factors.</p>
          ) : (
            <BarList data={pointsLost} sortOrder="descending" />
          )}
        </div>
      </div>

      <div className="mt-[14px] border-t border-surface-border pt-3">
        <div className="mb-1.5 flex items-baseline justify-between gap-2">
          <span className={dashboardType.metricLabel}>{caption}</span>
          <span
            className={cn(
              "shrink-0 tabular text-[11.5px] font-semibold",
              delta >= 0 ? "text-brand" : "text-semantic-danger",
            )}
          >
            {delta >= 0 ? "+" : ""}
            {delta} vs start
          </span>
        </div>
        <div className="h-[46px] w-full overflow-hidden">
          <svg
            width="100%"
            height="46"
            viewBox="0 0 320 46"
            preserveAspectRatio="none"
            className="block"
            aria-hidden
          >
            <defs>
              <linearGradient id="health-trend-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--chart-cleared)" stopOpacity="0.14" />
                <stop offset="100%" stopColor="var(--chart-cleared)" stopOpacity="0" />
              </linearGradient>
            </defs>
            {spark.area ? <path d={spark.area} fill="url(#health-trend-fill)" /> : null}
            {spark.line ? (
              <path
                d={spark.line}
                fill="none"
                stroke="var(--chart-cleared)"
                strokeWidth="2"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            ) : null}
          </svg>
        </div>
        <div className={cn("mt-1 flex justify-between", dashboardType.axisTick)}>
          {axis.map((labelText, i) => (
            <span key={`${labelText}-${i}`}>{labelText}</span>
          ))}
        </div>
      </div>
    </DashboardCard>
  );
}
