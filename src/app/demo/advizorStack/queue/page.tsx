import { Zap } from "lucide-react";
import { QueueTable } from "~/components/demo/advizor-stack/queue-table";
import {
  QUEUE_CLEAR_COUNT,
  QUEUE_ITEMS,
} from "~/components/demo/advizor-stack/demo-data";

export default function DemoQueuePage() {
  const needsReview = QUEUE_ITEMS.length;

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

      <QueueTable items={QUEUE_ITEMS} />
    </div>
  );
}
