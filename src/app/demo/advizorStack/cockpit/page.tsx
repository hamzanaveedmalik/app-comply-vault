import { Building2, Lock } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils";
import { DisclosuresCollapse } from "~/components/demo/advizor-stack/disclosures-collapse";
import {
  CONFIGURABLE_DISCLOSURES,
  DEMO_FIRM,
  LOCKED_DISCLOSURES,
  RISK_FLAGS,
  type RiskFlag,
} from "~/components/demo/advizor-stack/demo-data";

function flagClassName(tone: RiskFlag["tone"]): string {
  switch (tone) {
    case "high":
      return "border-red-200 bg-red-100 text-red-800";
    case "attention":
      return "border-amber-200 bg-amber-100 text-amber-800";
    default:
      return "";
  }
}

export default function DemoCockpitPage() {
  return (
    <div>
      <p className="mb-1.5 text-[13px] text-text-secondary">CRD lookup result</p>
      <h1 className="text-2xl font-semibold tracking-tight">
        Compliance cockpit
      </h1>

      <div className="mt-5 rounded-xl border bg-surface-card p-5">
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand text-white">
            <Building2 className="h-4 w-4" />
          </span>
          <div>
            <div className="text-sm font-semibold">{DEMO_FIRM.name}</div>
            <div className="text-xs text-text-secondary">
              {DEMO_FIRM.location} · CRD {DEMO_FIRM.crd} · {DEMO_FIRM.aum}
            </div>
          </div>
        </div>
      </div>

      <section className="mt-6">
        <h2 className="mb-1 text-sm font-semibold text-text-secondary">
          Risk flags and queue ranking
        </h2>
        <p className="mb-3 max-w-lg text-xs leading-relaxed text-text-secondary">
          These flags raise the bar for related meetings. Findings that touch
          them are ranked higher in the review queue automatically.
        </p>
        <ul className="flex flex-col gap-2">
          {RISK_FLAGS.map((flag) => (
            <li
              key={flag.label}
              className="flex flex-col gap-1.5 rounded-lg border bg-surface-card px-4 py-3 sm:flex-row sm:items-center sm:gap-3"
            >
              <Badge
                variant={flag.tone === "info" ? "secondary" : "default"}
                className={cn(
                  "w-fit shrink-0 sm:w-32 sm:justify-start",
                  flagClassName(flag.tone),
                )}
              >
                {flag.label}
              </Badge>
              <span className="text-xs leading-relaxed text-text-secondary">
                {flag.explanation}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-6">
        <h2 className="mb-2 text-sm font-semibold text-text-secondary">
          Always disclosed verbally, every meeting
        </h2>
        <div className="overflow-hidden rounded-lg border bg-surface-card">
          {LOCKED_DISCLOSURES.map((disclosure) => (
            <div
              key={disclosure.item}
              className="flex items-center gap-2.5 border-b px-4 py-2.5 text-[13px] last:border-b-0"
            >
              <Lock className="h-3.5 w-3.5 shrink-0 text-text-muted" />
              <span className="flex-1">{disclosure.item}</span>
              <span className="text-[11px] text-text-muted">
                {disclosure.reference}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-6">
        <h2 className="mb-2 text-sm font-semibold text-text-secondary">
          Configurable · {CONFIGURABLE_DISCLOSURES.length} items, all currently
          required
        </h2>
        <DisclosuresCollapse items={CONFIGURABLE_DISCLOSURES} />
      </section>
    </div>
  );
}
