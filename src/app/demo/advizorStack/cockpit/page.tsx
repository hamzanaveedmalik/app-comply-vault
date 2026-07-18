import Link from "next/link";
import { Building2, ChevronRight, Lock } from "lucide-react";
import { cn } from "~/lib/utils";
import { DisclosuresCollapse } from "~/components/demo/advizor-stack/disclosures-collapse";
import {
  CONFIGURABLE_DISCLOSURES,
  DEMO_BASE_PATH,
  DEMO_FIRM,
  LOCKED_DISCLOSURES,
  RISK_FLAGS,
  composeRiskSummary,
} from "~/components/demo/advizor-stack/demo-data";

export default function DemoCockpitPage() {
  return (
    <div>
      <p className="mb-1.5 text-[13px] text-text-secondary">CRD lookup result</p>
      <h1 className="text-2xl font-semibold tracking-tight">
        Compliance cockpit
      </h1>

      <div className="mt-5 flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-light text-brand">
          <Building2 className="h-5 w-5" />
        </span>
        <div>
          <div className="text-sm font-semibold">{DEMO_FIRM.name}</div>
          <div className="text-xs text-text-secondary">
            {DEMO_FIRM.location} · CRD {DEMO_FIRM.crd} · {DEMO_FIRM.aum}
          </div>
        </div>
      </div>

      <p className="mt-4 mb-7 max-w-xl text-sm leading-relaxed text-text-secondary">
        {composeRiskSummary(RISK_FLAGS)}
      </p>

      <section className="mb-6">
        <h2 className="mb-2 text-[13px] font-semibold text-text-muted">
          Risk drivers, ranked
        </h2>
        {/*
          Risk drivers are derived from illustrative CRD / firm metadata, not
          live Flag records. Rows navigate to the review queue with a stubbed
          `?risk=<tag>` param. TODO: once a tag-to-flag mapping exists, feed real
          flag counts in here and have the queue filter on the tag.
        */}
        <div className="overflow-hidden rounded-lg border bg-surface-card">
          {RISK_FLAGS.map((flag) => (
            <Link
              key={flag.riskTag}
              href={`${DEMO_BASE_PATH}/queue?risk=${flag.riskTag}`}
              className="flex items-center gap-2.5 border-b px-4 py-3 text-sm transition-colors last:border-b-0 hover:bg-surface-hover"
            >
              <span
                className={cn(
                  "h-1.5 w-1.5 shrink-0 rounded-full",
                  flag.tone === "high"
                    ? "bg-semantic-danger"
                    : "bg-semantic-warning",
                )}
                aria-hidden
              />
              <span className="flex-1">{flag.label}</span>
              <span className="text-xs text-text-secondary">{flag.reason}</span>
              <ChevronRight className="h-4 w-4 shrink-0 text-text-muted" />
            </Link>
          ))}
        </div>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 text-[13px] font-semibold text-text-muted">
          Always disclosed verbally, every meeting
        </h2>
        <div className="overflow-hidden rounded-lg border">
          {LOCKED_DISCLOSURES.map((disclosure) => (
            <div
              key={disclosure.item}
              className="flex items-center gap-2.5 border-b bg-surface-muted px-4 py-2.5 text-sm last:border-b-0"
            >
              <Lock className="h-3.5 w-3.5 shrink-0 text-text-muted" />
              <span className="flex-1">{disclosure.item}</span>
              <span className="text-xs text-text-muted">
                {disclosure.reference}
              </span>
            </div>
          ))}
        </div>
      </section>

      <DisclosuresCollapse items={CONFIGURABLE_DISCLOSURES} />
    </div>
  );
}
