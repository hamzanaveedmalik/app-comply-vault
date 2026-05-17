"use client";

import FlagsPanel from "./flags-panel";
import { FlagTriageCard, type FlagTriageCardFlag } from "~/components/flags/flag-triage-card";
import { CollapsedFlagGroup } from "~/components/flags/collapsed-flag-group";
import {
  sortFlagsForWorkspace,
  isCcoEscalationFlag,
  isCcoSummaryFlag,
} from "~/lib/flag-workspace-sort";
import { isCcoActor } from "~/lib/meeting-workflow";
import type { CmFlagDisposition, FlagStatus } from "../../../../../generated/prisma";
import type { FlagItem } from "./flags-panel";

// Re-use panel’s flag shape; map resolutionRecord from page DTO
export type MeetingFlagDTO = FlagItem;

function toTriageFlag(f: MeetingFlagDTO): FlagTriageCardFlag {
  return {
    id: f.id,
    type: f.type,
    severity: f.severity,
    status: f.status as FlagStatus,
    evidence: f.evidence,
    createdAt: f.createdAt,
    cmDisposition: (f.cmDisposition ?? "NONE") as CmFlagDisposition,
    escalationReason: f.escalationReason,
    cmTriageNote: f.cmTriageNote,
    resolutionNote: f.resolutionNote,
    resolutionRecord: f.resolutionRecord,
  };
}

export default function MeetingFlagsWorkspace({
  meetingId: _meetingId,
  meetingStatus,
  flags,
  userRole,
  currentUserId,
  readOnlyCompliance,
}: {
  meetingId: string;
  meetingStatus: string;
  flags: MeetingFlagDTO[];
  userRole: string | null | undefined;
  currentUserId: string | null | undefined;
  readOnlyCompliance?: boolean;
}) {
  void _meetingId;

  return (
    <FlagsPanel
      flags={flags}
      userRole={userRole}
      currentUserId={currentUserId}
      readOnlyCompliance={readOnlyCompliance}
      renderFlagCards={({ openRemediation, openAcceptRisk }) => {
        const triageFlags = flags.map(toTriageFlag);
        const sorted = sortFlagsForWorkspace(triageFlags);
        const mapOpen = (item: FlagTriageCardFlag): void => {
          const raw = flags.find((x) => x.id === item.id);
          if (raw) openRemediation(raw);
        };
        const mapRisk = (item: FlagTriageCardFlag): void => {
          const raw = flags.find((x) => x.id === item.id);
          if (raw) openAcceptRisk(raw);
        };

        if (sorted.length === 0) {
          return <p className="text-[13px] text-muted-foreground">No flags for this meeting.</p>;
        }

        const showCcoSplit =
          isCcoActor(userRole as never) && meetingStatus === "CM_REVIEWED";

        if (showCcoSplit) {
          const escalated = sorted.filter((f) => isCcoEscalationFlag(f));
          const summarized = sorted.filter((f) => isCcoSummaryFlag(f));
          const other = sorted.filter((f) => !isCcoEscalationFlag(f) && !isCcoSummaryFlag(f));

          return (
            <div className="space-y-3">
              <h3 className="text-[13px] font-medium text-foreground">Flag workspace</h3>
              {escalated.map((flag) => (
                <FlagTriageCard
                  key={flag.id}
                  flag={flag}
                  meetingStatus={meetingStatus}
                  userRole={userRole}
                  readOnlyCompliance={readOnlyCompliance}
                  onOpenRemediation={mapOpen}
                  onAcceptRisk={mapRisk}
                  currentUserId={currentUserId}
                />
              ))}
              {other.map((flag) => (
                <FlagTriageCard
                  key={flag.id}
                  flag={flag}
                  meetingStatus={meetingStatus}
                  userRole={userRole}
                  readOnlyCompliance={readOnlyCompliance}
                  onOpenRemediation={mapOpen}
                  onAcceptRisk={mapRisk}
                  currentUserId={currentUserId}
                />
              ))}
              {summarized.length > 0 ? (
                <CollapsedFlagGroup
                  flags={summarized}
                  meetingStatus={meetingStatus}
                  userRole={userRole}
                  readOnlyCompliance={readOnlyCompliance}
                  currentUserId={currentUserId}
                  onOpenRemediation={mapOpen}
                />
              ) : null}
            </div>
          );
        }

        return (
          <div className="space-y-3">
            <h3 className="text-[13px] font-medium text-foreground">Flag workspace</h3>
            {sorted.map((flag) => (
              <FlagTriageCard
                key={flag.id}
                flag={flag}
                meetingStatus={meetingStatus}
                userRole={userRole}
                readOnlyCompliance={readOnlyCompliance}
                onOpenRemediation={mapOpen}
                onAcceptRisk={mapRisk}
                currentUserId={currentUserId}
              />
            ))}
          </div>
        );
      }}
    />
  );
}
