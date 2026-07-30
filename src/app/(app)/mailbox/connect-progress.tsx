"use client";

import { Badge } from "~/components/ui/badge";
import { isRelease1DemoEnabled } from "~/lib/feature-flags";

export const CONNECT_PROGRESS_STAGES = [
  "authorising",
  "enumerating",
  "ingesting",
  "classifying",
  "resolving",
] as const;

export type ConnectProgressStage = (typeof CONNECT_PROGRESS_STAGES)[number];

export function ConnectProgress({
  currentStage,
}: {
  currentStage: ConnectProgressStage;
}): React.JSX.Element | null {
  if (!isRelease1DemoEnabled()) return null;

  const currentIndex = CONNECT_PROGRESS_STAGES.indexOf(currentStage);
  return (
    <ol className="flex flex-wrap gap-2" aria-label="Mailbox connection progress">
      {CONNECT_PROGRESS_STAGES.map((stage, index) => (
        <li key={stage}>
          <Badge
            variant={index === currentIndex ? "default" : "outline"}
            className={index < currentIndex ? "border-brand/30 bg-brand/10 text-brand" : undefined}
          >
            {stage}
          </Badge>
        </li>
      ))}
    </ol>
  );
}
