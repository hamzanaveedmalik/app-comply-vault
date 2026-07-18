import Link from "next/link";
import { X, Zap } from "lucide-react";
import { QueueTable } from "~/components/demo/advizor-stack/queue-table";
import {
  DEMO_BASE_PATH,
  QUEUE_CLEAR_COUNT,
  QUEUE_ITEMS,
  RISK_FLAGS,
} from "~/components/demo/advizor-stack/demo-data";

export default async function DemoQueuePage({
  searchParams,
}: {
  searchParams: Promise<{ risk?: string }>;
}) {
  const { risk } = await searchParams;
  const activeRisk = risk ? RISK_FLAGS.find((f) => f.riskTag === risk) : undefined;

  // TODO: when risk drivers are tied to live Flag records, filter QUEUE_ITEMS by
  // `activeRisk` here (e.g. items whose flags carry the risk tag). For now the
  // param is acknowledged but the ranked list is shown in full.
  const items = QUEUE_ITEMS;
  const needsReview = items.length;

  return (
    <div>
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {needsReview} need your review
          </h1>
          <p className="mt-0.5 text-sm text-text-secondary">
            Ranked by relationship value and severity · {QUEUE_CLEAR_COUNT}{" "}
            clear
          </p>
        </div>
        <span className="flex shrink-0 items-center gap-1.5 text-xs text-text-secondary">
          <Zap className="h-3.5 w-3.5 text-brand" />
          Hadrius connected
        </span>
      </div>

      {activeRisk ? (
        <div className="mb-3 flex w-fit items-center gap-2 rounded-full border bg-surface-card px-3 py-1 text-xs text-text-secondary">
          Filtered by risk driver: {activeRisk.label}
          <Link
            href={`${DEMO_BASE_PATH}/queue`}
            aria-label="Clear risk filter"
            className="text-text-muted hover:text-text-primary"
          >
            <X className="h-3.5 w-3.5" />
          </Link>
        </div>
      ) : null}

      <QueueTable items={items} />
    </div>
  );
}
