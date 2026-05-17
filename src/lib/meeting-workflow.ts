import type { CmFlagDisposition, FlagStatus, MeetingStatus, WorkspaceRole } from "../../generated/prisma";

export type FlagTriageCheck = {
  status: FlagStatus;
  cmDisposition: CmFlagDisposition;
};

export function isAdvisorActor(role: WorkspaceRole | null | undefined): boolean {
  return role === "ADVISOR" || role === "OWNER_CCO";
}

export function isComplianceActor(role: WorkspaceRole | null | undefined): boolean {
  return role === "MEMBER" || role === "OWNER_CCO";
}

export function isCcoActor(role: WorkspaceRole | null | undefined): boolean {
  return role === "OWNER_CCO";
}

/** Whether the flag is fully triaged by CM for "complete review" (or already closed from legacy flows). */
export function flagIsCmTriaged(flag: FlagTriageCheck): boolean {
  if (flag.status === "CLOSED" || flag.status === "CLOSED_ACCEPTED_RISK") {
    return true;
  }
  return flag.cmDisposition !== "NONE";
}

export function hasPendingCcoEscalations(flags: Pick<FlagTriageCheck, "status">[]): boolean {
  return flags.some((f) => f.status === "PENDING_VERIFICATION");
}

export function meetingAllowsTranscriptEdit(status: MeetingStatus): boolean {
  return status === "DRAFT_READY" || status === "DRAFT";
}

export function meetingAllowsAdvisorCertify(status: MeetingStatus): boolean {
  return status === "DRAFT_READY";
}

export function meetingAllowsCmTriage(status: MeetingStatus): boolean {
  return status === "ADVISOR_CERTIFIED";
}

export function meetingAllowsCmComplete(status: MeetingStatus): boolean {
  return status === "ADVISOR_CERTIFIED";
}

export function meetingAllowsCcoSignOff(status: MeetingStatus): boolean {
  return status === "CM_REVIEWED";
}

export function meetingAllowsFinalizeAfterSignoff(status: MeetingStatus): boolean {
  return status === "CCO_SIGNED_OFF";
}
