import type { DashboardSummary } from "~/lib/dashboard-types";
import { buildSparkline } from "~/lib/sparkline";
import { DashboardCard } from "~/components/dashboard/dashboard-card";

type ComplianceHealthCardProps = {
  score: number;
  label: string;
  delta: number;
  breakdown: DashboardSummary["healthBreakdown"];
  trend: DashboardSummary["healthTrend"];
};

const RING_R = 36;
const RING_CIRC = 2 * Math.PI * RING_R;

function arcColor(score: number): string {
  if (score <= 39) return "#c13a2a";
  if (score <= 69) return "#b26a12";
  return "#177a4c";
}

function factorColor(value: number): string {
  if (value >= 70) return "#177a4c";
  if (value >= 40) return "#b26a12";
  return "#c13a2a";
}

export function ComplianceHealthCard({
  score,
  label,
  delta,
  breakdown,
  trend,
}: ComplianceHealthCardProps): React.JSX.Element {
  const dashOffset = RING_CIRC * (1 - Math.max(0, Math.min(100, score)) / 100);
  const color = arcColor(score);

  const factors = [
    { label: "Meeting coverage", value: breakdown.meetingCoverage },
    { label: "Docs finalized", value: breakdown.documentsFinalised },
    { label: "Flags resolved", value: breakdown.flagsResolved },
    { label: "Signatures", value: breakdown.signaturesComplete },
  ];

  const spark = buildSparkline(
    trend.map((t) => t.score),
    { width: 320, height: 46, pad: 6 },
  );
  const axis = [0, 1, 2, 3].map((q) => trend[Math.floor((trend.length - 1) * (q / 3))]?.label ?? "");

  return (
    <DashboardCard title="Compliance Health" link={{ href: "/compliance-cockpit", label: "Details" }}>
      <div className="grid grid-cols-[auto_1fr] items-center gap-5">
        <div className="relative h-[84px] w-[84px] shrink-0">
          <svg width="84" height="84" viewBox="0 0 84 84" className="-rotate-90">
            <circle cx="42" cy="42" r={RING_R} stroke="#eff1ef" strokeWidth="7" fill="none" />
            <circle
              cx="42"
              cy="42"
              r={RING_R}
              stroke={color}
              strokeWidth="7"
              fill="none"
              strokeLinecap="round"
              strokeDasharray={RING_CIRC.toFixed(2)}
              strokeDashoffset={dashOffset.toFixed(2)}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="text-[21px] font-[650] leading-none tabular-nums text-[#141f19]">
              {score}
            </div>
            <div className="mt-0.5 text-[9px] uppercase tracking-[0.06em] text-[#79837d]">
              {label}
            </div>
          </div>
        </div>
        <div className="flex min-w-0 flex-col gap-2">
          {factors.map((f) => (
            <div
              key={f.label}
              className="grid grid-cols-[104px_1fr_26px] items-center gap-[9px]"
            >
              <span className="whitespace-nowrap text-[11px] text-[#3f4b45]">{f.label}</span>
              <div className="h-[5px] overflow-hidden rounded-[3px] bg-[#eff1ef]">
                <div
                  className="h-full rounded-[3px]"
                  style={{ width: `${Math.max(0, Math.min(100, f.value))}%`, background: factorColor(f.value) }}
                />
              </div>
              <span className="text-right text-[11px] font-semibold tabular-nums text-[#141f19]">
                {f.value}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-[14px] border-t border-[#e6e8e6] pt-3">
        <div className="mb-1.5 flex items-baseline justify-between">
          <span className="text-[10.5px] font-semibold uppercase tracking-[0.05em] text-[#79837d]">
            12-week trend
          </span>
          <span
            className={`text-[11.5px] font-semibold ${delta >= 0 ? "text-[#177a4c]" : "text-[#c13a2a]"}`}
          >
            {delta >= 0 ? "+" : ""}
            {delta} vs Q1
          </span>
        </div>
        <svg width="100%" height="46" viewBox="0 0 320 46" preserveAspectRatio="none">
          <defs>
            <linearGradient id="health-trend-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#177a4c" stopOpacity="0.14" />
              <stop offset="100%" stopColor="#177a4c" stopOpacity="0" />
            </linearGradient>
          </defs>
          {spark.area ? <path d={spark.area} fill="url(#health-trend-fill)" /> : null}
          {spark.line ? (
            <path
              d={spark.line}
              fill="none"
              stroke="#177a4c"
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ) : null}
          {spark.line ? <circle cx={spark.last.x} cy={spark.last.y} r="3" fill="#177a4c" /> : null}
        </svg>
        <div className="mt-1 flex justify-between text-[10px] tabular-nums text-[#79837d]">
          {axis.map((label, i) => (
            <span key={`${label}-${i}`}>{label}</span>
          ))}
        </div>
      </div>
    </DashboardCard>
  );
}
