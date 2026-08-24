import type { AuditReadiness } from "~/lib/dashboard-types";
import { DashboardCard } from "~/components/dashboard/dashboard-card";

type AuditReadinessCardProps = {
  readiness: AuditReadiness;
};

export function AuditReadinessCard({ readiness }: AuditReadinessCardProps): React.JSX.Element {
  const pct = readiness.total === 0 ? 0 : (readiness.ready / readiness.total) * 100;

  return (
    <DashboardCard title="Audit Readiness" link={{ href: "/audit-packs", label: "View packs" }}>
      <div className="flex items-baseline gap-1.5">
        <span className="text-[26px] font-[650] leading-none tracking-[-0.02em] tabular-nums text-[#141f19]">
          {readiness.ready}
          <span className="text-[15px] font-medium text-[#79837d]">/{readiness.total}</span>
        </span>
        <span className="text-[12.5px] text-[#79837d]">meetings SEC-ready</span>
      </div>
      <svg width="100%" height="12" viewBox="0 0 320 12" preserveAspectRatio="none" className="mt-3.5">
        <rect x="0" y="2" width="320" height="8" rx="4" fill="#eff1ef" />
        <rect x="0" y="2" width={(pct / 100) * 320} height="8" rx="4" fill="#177a4c" />
      </svg>
      <div className="mt-3 text-[11.5px] text-[#79837d]">
        {readiness.blocked > 0 ? (
          <>
            {readiness.blocked} {readiness.blocked === 1 ? "meeting" : "meetings"} blocked ·{" "}
            <b className="text-[#141f19]">{readiness.blockedReason}</b>
          </>
        ) : (
          <>All reviewed meetings finalized</>
        )}
      </div>
    </DashboardCard>
  );
}
