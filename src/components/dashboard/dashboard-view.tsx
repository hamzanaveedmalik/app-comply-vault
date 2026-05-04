import Link from "next/link";
import type { DashboardSummary } from "~/lib/dashboard-types";
import { HealthGauge } from "~/components/dashboard/health-gauge";
import { FlagsAreaChart } from "~/components/dashboard/flags-area-chart";
import { FlagCategoryBars } from "~/components/dashboard/flag-category-bars";
import { MeetingTypeDonut } from "~/components/dashboard/meeting-type-donut";
import { FinalizeSparkline } from "~/components/dashboard/finalize-sparkline";
import { PipelineBar } from "~/components/dashboard/pipeline-bar";
import { DashboardMeetingTable } from "~/components/dashboard/dashboard-meeting-table";

type DashboardViewProps = {
  summary: DashboardSummary;
};

export function DashboardView({ summary }: DashboardViewProps): React.JSX.Element {
  const pendingCard = (
    <div className="flex h-full min-h-[140px] flex-col justify-between rounded-[14px] border-y border-r border-surface-border border-l-[3px] border-l-semantic-orange bg-surface-card p-4 shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
      <span className="text-[11px] font-semibold uppercase tracking-[0.05em] text-text-secondary">
        Pending review
      </span>
      <div>
        <div className="text-[36px] font-bold leading-none text-semantic-orange">{summary.pendingReview}</div>
        <p className="mt-1 text-[12px] text-text-muted">meetings</p>
      </div>
      <Link
        href="/review"
        className="mt-2 text-[11px] font-semibold text-semantic-orange hover:underline"
      >
        Review now →
      </Link>
    </div>
  );

  const auditCard = (
    <div className="flex h-full min-h-[140px] flex-col justify-between rounded-[14px] border-y border-r border-surface-border border-l-[3px] border-l-brand bg-surface-card p-4 shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
      <span className="text-[11px] font-semibold uppercase tracking-[0.05em] text-text-secondary">
        Audit packs
      </span>
      <div>
        <div className="text-[36px] font-bold leading-none text-brand">{summary.auditPacksGenerated}</div>
        <p className="mt-1 text-[12px] text-text-muted">SEC-ready</p>
      </div>
      <Link href="/audit-packs" className="mt-2 text-[11px] font-semibold text-brand hover:underline">
        View pack →
      </Link>
    </div>
  );

  return (
    <div className="space-y-4 pb-10">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[240px_minmax(0,1fr)_minmax(0,1fr)]">
        <div className="md:col-span-2 xl:col-span-1">
          <HealthGauge
            score={summary.healthScore}
            openFlags={summary.openFlags}
            unfinalizedCount={summary.unfinalizedCount}
          />
        </div>
        <FlagsAreaChart
          data={summary.flagsTrend}
          openFlags={summary.openFlags}
          flagsDelta={summary.flagsDelta}
          flagsTrending={summary.flagsTrending}
        />
        <FlagCategoryBars categories={summary.flagsByCategory} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-[1.3fr_1fr_0.55fr_0.55fr]">
        <MeetingTypeDonut data={summary.meetingsByType} />
        <FinalizeSparkline data={summary.finalizeTrend} avgDays={summary.avgTimeToFinalize} />
        {pendingCard}
        {auditCard}
      </div>

      <PipelineBar pipeline={summary.pipeline} />

      {summary.recentMeetings.length === 0 ? (
        <section className="rounded-[14px] border border-dashed border-surface-border bg-surface-card p-10 text-center shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
          <p className="text-text-secondary">No meetings yet.</p>
          <Link
            href="/upload"
            className="mt-4 inline-flex rounded-lg bg-brand px-4 py-2 text-[12px] font-semibold text-white shadow-[0_2px_8px_rgba(17,122,75,0.15)]"
          >
            Upload Meeting
          </Link>
        </section>
      ) : (
        <DashboardMeetingTable
          totalMeetings={summary.totalMeetings}
          pendingReview={summary.pendingReview}
          initialRows={summary.recentMeetings}
        />
      )}
    </div>
  );
}
