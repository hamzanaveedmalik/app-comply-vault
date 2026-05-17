"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "~/lib/utils";
import type { FlagTriageCardFlag } from "./flag-triage-card";
import { FlagTriageCard } from "./flag-triage-card";

export function CollapsedFlagGroup({
  flags,
  meetingStatus,
  userRole,
  readOnlyCompliance,
  onOpenRemediation,
  currentUserId,
}: {
  flags: FlagTriageCardFlag[];
  meetingStatus: string;
  userRole: string | null | undefined;
  readOnlyCompliance?: boolean;
  onOpenRemediation?: (flag: FlagTriageCardFlag) => void;
  currentUserId: string | null | undefined;
}): React.ReactElement {
  const [open, setOpen] = useState(false);
  const resolved = flags.filter((f) => f.cmDisposition === "RESOLVED" || f.status === "CLOSED").length;
  const noted = flags.filter((f) => f.cmDisposition === "NOTED").length;

  return (
    <div className="rounded-xl border border-border bg-card">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-4 py-3 text-left text-[13px] font-medium hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        aria-expanded={open}
      >
        <ChevronRight
          className={cn("h-4 w-4 shrink-0 transition-transform", open && "rotate-90")}
          aria-hidden
        />
        <span>Compliance manager resolved ({flags.length} flags)</span>
        <span className="text-[12px] font-normal text-muted-foreground">
          {resolved} resolved · {noted} noted
        </span>
      </button>
      {open ? (
        <div className="space-y-3 border-t border-border px-4 py-3" role="region">
          {flags.map((flag) => (
            <FlagTriageCard
              key={flag.id}
              flag={flag}
              meetingStatus={meetingStatus}
              userRole={userRole}
              readOnlyCompliance={readOnlyCompliance}
              forceSummaryOnlyOverride
              onOpenRemediation={onOpenRemediation}
              currentUserId={currentUserId}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
