"use client";

import { useId, useMemo, useState } from "react";
import { Lock, ChevronDown } from "lucide-react";
import { cn } from "~/lib/utils";
import type { TranscriptSegment } from "~/server/transcription/types";

export function MeetingTranscriptSection({
  collapsedByDefault,
  transcriptSegments,
  topicCount,
  recommendationCount,
  advisorExpandedGrid,
  expandedContent,
}: {
  collapsedByDefault: boolean;
  transcriptSegments: TranscriptSegment[];
  topicCount: number;
  recommendationCount: number;
  /** Full-width grid (advisor pre-certification). */
  advisorExpandedGrid: React.ReactNode;
  /** Transcript + fields when expanded after certification. */
  expandedContent: React.ReactNode;
}): React.ReactElement {
  const panelId = useId();
  const [open, setOpen] = useState(false);

  const { wordCount, durationLabel } = useMemo(() => {
    let words = 0;
    for (const s of transcriptSegments) {
      words += s.text.trim().split(/\s+/).filter(Boolean).length;
    }
    const last = transcriptSegments[transcriptSegments.length - 1];
    const end = last?.endTime ?? 0;
    const m = Math.floor(end / 60);
    const sec = Math.floor(end % 60);
    return { wordCount: words, durationLabel: `${m} min ${sec.toString().padStart(2, "0")} sec` };
  }, [transcriptSegments]);

  if (!collapsedByDefault) {
    return <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">{advisorExpandedGrid}</div>;
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-start gap-3 rounded-xl border border-border bg-card px-5 py-4 text-left shadow-sm hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        aria-expanded={open}
        aria-controls={panelId}
      >
        <Lock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium leading-snug">
            Transcript locked after advisor certification · {wordCount.toLocaleString()} words · {durationLabel}
          </p>
          <p className="mt-1 text-[12px] text-muted-foreground">
            {topicCount} topics · {recommendationCount} recommendations ·{" "}
            <span className="inline-flex items-center gap-1 font-medium text-foreground">
              {open ? "Hide full transcript" : "View full transcript"}
              <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
            </span>
          </p>
        </div>
      </button>
      {open ? (
        <div id={panelId} role="region" aria-label="Full transcript and extracted fields">
          {expandedContent}
        </div>
      ) : null}
    </div>
  );
}
