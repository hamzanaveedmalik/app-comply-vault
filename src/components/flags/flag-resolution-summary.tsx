"use client";

import { Check, ArrowUp, FileText } from "lucide-react";
import { cn } from "~/lib/utils";
import type { CmFlagDisposition } from "../../../generated/prisma";

export function FlagResolutionSummary({
  disposition,
  noteText,
}: {
  disposition: CmFlagDisposition;
  noteText: string;
}): React.ReactElement {
  const style =
    disposition === "RESOLVED"
      ? {
          wrap: "bg-[#E1F5EE] text-[#085041]",
          icon: <Check className="h-3.5 w-3.5 shrink-0" aria-hidden />,
          label: "Resolved",
        }
      : disposition === "NOTED"
        ? {
            wrap: "bg-[#E6F1FB] text-[#0C447C]",
            icon: <FileText className="h-3.5 w-3.5 shrink-0" aria-hidden />,
            label: "Noted",
          }
        : {
            wrap: "bg-[#FAEEDA] text-[#633806]",
            icon: <ArrowUp className="h-3.5 w-3.5 shrink-0" aria-hidden />,
            label: "Escalated",
          };

  return (
    <div
      className={cn("flex items-start gap-2 rounded-lg px-3 py-2 text-[12px] cv-motion-fade-in", style.wrap)}
      role="status"
      aria-live="polite"
    >
      {style.icon}
      <span>
        <span className="font-medium">{style.label}:</span> {noteText}
      </span>
    </div>
  );
}
