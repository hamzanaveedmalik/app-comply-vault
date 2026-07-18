import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { cn } from "~/lib/utils";
import {
  DEMO_BASE_PATH,
  getQueueItem,
} from "~/components/demo/advizor-stack/demo-data";
import {
  DecisionForm,
  EvidenceActions,
} from "~/components/demo/advizor-stack/evidence-client";

export default async function DemoEvidencePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const item = getQueueItem(id);

  if (!item) {
    notFound();
  }

  return (
    <div>
      <Link
        href={`${DEMO_BASE_PATH}/queue`}
        className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-text-secondary hover:text-text-primary"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to queue
      </Link>

      <h1 className="text-2xl font-semibold tracking-tight">{item.headline}</h1>
      <p className="mt-1 text-sm text-text-secondary">
        {item.name} · {item.firm} · Adviser {item.adviser} · Source:{" "}
        {item.source}
      </p>

      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1.25fr_1fr]">
        <section className="rounded-lg border bg-surface-card p-4">
          <h2 className="mb-3 text-[11px] font-medium uppercase tracking-wide text-text-muted">
            Triage signals
          </h2>
          <ul className="flex flex-col">
            {item.findings.map((finding, index) => (
              <li
                key={finding.title}
                className={cn(
                  "border-b py-2.5 first:pt-0 last:border-b-0 last:pb-0",
                  index === 0 && "pt-0",
                )}
              >
                <div
                  className={cn(
                    "text-[13px] font-semibold",
                    finding.highRisk && "text-red-700",
                  )}
                >
                  {finding.title}
                </div>
                <div className="mt-0.5 text-xs leading-relaxed text-text-secondary">
                  {finding.detail}
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[11px] leading-relaxed text-text-muted">
            AI-generated triage signals, pending your review.
          </p>
        </section>

        <section className="rounded-lg border bg-surface-card p-4">
          <h2 className="mb-3 text-[11px] font-medium uppercase tracking-wide text-text-muted">
            Evidence
          </h2>
          <div className="mb-2 text-xs text-text-muted">
            {item.transcript.timestamp} · {item.transcript.speaker}
          </div>
          <p className="mb-3 rounded-md bg-amber-100 px-2.5 py-2 text-[13px] leading-relaxed text-amber-900">
            &ldquo;{item.transcript.excerpt}&rdquo;
          </p>
          <p className="mb-4 text-xs leading-relaxed text-text-secondary">
            <span className="font-semibold text-text-primary">
              Why this was surfaced —{" "}
            </span>
            {item.why}
          </p>
          <EvidenceActions startTime={item.transcript.timestamp} />
        </section>

        <section className="rounded-lg border bg-surface-card p-4">
          <h2 className="mb-3 text-[11px] font-medium uppercase tracking-wide text-text-muted">
            Decision
          </h2>
          <DecisionForm />
        </section>
      </div>
    </div>
  );
}
