import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import {
  DEMO_BASE_PATH,
  MEDIAN_REVIEW_TIME,
  QUEUE_ITEMS,
  TOTAL_CAPTURED,
  TOTAL_REVIEWED,
} from "~/components/demo/advizor-stack/demo-data";

export default function DemoHomePage() {
  const needsReview = QUEUE_ITEMS.length;
  const topPriority = QUEUE_ITEMS[0];

  const stats = [
    { label: "Captured", value: String(TOTAL_CAPTURED) },
    { label: "Reviewed", value: `${TOTAL_REVIEWED} / ${TOTAL_CAPTURED}` },
    { label: "Median review time", value: MEDIAN_REVIEW_TIME },
  ];

  return (
    <div>
      <section className="pt-14 pb-10">
        <p className="mb-1.5 text-[13px] text-text-secondary">
          Across {TOTAL_CAPTURED} interactions
        </p>
        <h1 className="mb-2 text-2xl font-semibold tracking-tight">
          {needsReview} things need you.
        </h1>
        {topPriority ? (
          <p className="max-w-md text-sm leading-relaxed text-text-secondary">
            Top priority: a possible fee disclosure gap in a rollover discussion
            at {topPriority.firm} — your highest-value relationship. Everything
            else has been captured and reviewed.
          </p>
        ) : null}
        <div className="mt-6">
          <Button asChild className="bg-brand hover:bg-brand-dark">
            <Link href={`${DEMO_BASE_PATH}/queue`}>
              Review queue
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {stats.map((stat) => (
          <Card key={stat.label} className="gap-0 py-0 shadow-none">
            <CardContent className="px-4 py-3.5">
              <div className="mb-1 text-xs text-text-muted">{stat.label}</div>
              <div className="text-lg font-semibold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
