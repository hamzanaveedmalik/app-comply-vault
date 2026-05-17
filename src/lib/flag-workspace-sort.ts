import type { CmFlagDisposition, FlagStatus } from "../../generated/prisma";

export type FlagWorkspaceSortable = {
  id: string;
  status: FlagStatus;
  cmDisposition: CmFlagDisposition;
  severity: string;
  createdAt: Date | string;
};

function triageGroup(flag: FlagWorkspaceSortable): number {
  if (flag.status === "CLOSED" || flag.status === "CLOSED_ACCEPTED_RISK") {
    return 3;
  }
  if (flag.status === "PENDING_VERIFICATION" || flag.cmDisposition === "ESCALATED") {
    return 1;
  }
  if (flag.cmDisposition === "NOTED") {
    return 2;
  }
  if (flag.cmDisposition === "RESOLVED") {
    return 3;
  }
  if (flag.status === "OPEN" && flag.cmDisposition === "NONE") {
    return 0;
  }
  if (flag.status === "IN_REMEDIATION") {
    return 0;
  }
  return 3;
}

function severityRank(severity: string): number {
  if (severity === "CRITICAL") return 0;
  if (severity === "WARN") return 1;
  return 2;
}

export function sortFlagsForWorkspace<T extends FlagWorkspaceSortable>(flags: T[]): T[] {
  return [...flags].sort((a, b) => {
    const g = triageGroup(a) - triageGroup(b);
    if (g !== 0) return g;
    const sev = severityRank(a.severity) - severityRank(b.severity);
    if (sev !== 0) return sev;
    const ta = new Date(a.createdAt).getTime();
    const tb = new Date(b.createdAt).getTime();
    return ta - tb;
  });
}

export function isCcoSummaryFlag(flag: FlagWorkspaceSortable): boolean {
  if (flag.status === "PENDING_VERIFICATION" || flag.cmDisposition === "ESCALATED") {
    return false;
  }
  return (
    flag.cmDisposition === "RESOLVED" ||
    flag.cmDisposition === "NOTED" ||
    flag.status === "CLOSED" ||
    flag.status === "CLOSED_ACCEPTED_RISK"
  );
}

export function isCcoEscalationFlag(flag: FlagWorkspaceSortable): boolean {
  return flag.status === "PENDING_VERIFICATION" || flag.cmDisposition === "ESCALATED";
}
