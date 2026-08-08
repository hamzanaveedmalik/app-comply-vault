/**
 * CV-SI-029 — Stable AdvizorStack synthetic tenant registry.
 * One Workspace = one firm. Portfolio aggregation joins these firm workspace IDs.
 */

export const ADVIZORSTACK_ONBOARDING_TYPE = "SYNTHETIC_ADVIZORSTACK" as const;

export const ADVIZORSTACK_PRIMARY_FINDING = {
  flagId: "si-as-flag-rollover-001",
  meetingId: "si-as-sec-mtg-pri-001",
  workspaceId: "si-as-ws-secure",
  href: "/findings/si-as-flag-rollover-001",
} as const;

export type AdvizorStackFirmDef = {
  workspaceId: string;
  firmProfileId: string;
  name: string;
  crdNumber: string;
  ccoName: string;
  meetingPrefix: string;
  clientName: string;
  cleared: number;
  sampled: number;
  /** Exactly one priority escalation per firm in the seeded demo. */
  priority: {
    meetingId: string;
    flagId: string;
    control: "MISSING_DISCLOSURE" | "PERFORMANCE_CLAIM" | "FEE_DISPUTE";
    reason: string;
  };
};

export const ADVIZORSTACK_FIRMS: readonly AdvizorStackFirmDef[] = [
  {
    workspaceId: "si-as-ws-secure",
    firmProfileId: "si-as-fp-secure",
    name: "Secure Investment Management",
    crdNumber: "AS-1001",
    ccoName: "Elena Vasquez",
    meetingPrefix: "si-as-sec-mtg-",
    clientName: "Helen Navarro",
    cleared: 50,
    sampled: 2,
    priority: {
      meetingId: "si-as-sec-mtg-pri-001",
      flagId: "si-as-flag-rollover-001",
      control: "MISSING_DISCLOSURE",
      reason: "Rollover recommendation with unresolved insurance conflict",
    },
  },
  {
    workspaceId: "si-as-ws-desert-ridge",
    firmProfileId: "si-as-fp-desert-ridge",
    name: "Desert Ridge Wealth",
    crdNumber: "AS-1002",
    ccoName: "Marcus Hale",
    meetingPrefix: "si-as-drw-mtg-",
    clientName: "David Okonkwo",
    cleared: 45,
    sampled: 2,
    priority: {
      meetingId: "si-as-drw-mtg-pri-001",
      flagId: "si-as-flag-perf-001",
      control: "PERFORMANCE_CLAIM",
      reason: "Unsupported performance-language concern",
    },
  },
  {
    workspaceId: "si-as-ws-northstar",
    firmProfileId: "si-as-fp-northstar",
    name: "Northstar Advisory",
    crdNumber: "AS-1003",
    ccoName: "Priya Shah",
    meetingPrefix: "si-as-ns-mtg-",
    clientName: "Claire Brennan",
    cleared: 44,
    sampled: 1,
    priority: {
      meetingId: "si-as-ns-mtg-pri-001",
      flagId: "si-as-flag-fee-001",
      control: "FEE_DISPUTE",
      reason: "Fee-disclosure inconsistency",
    },
  },
] as const;

export const ADVIZORSTACK_ADVISERS = [
  {
    id: "si-as-user-adv-a",
    email: "adviser.a@synthetic.advizorstack.example.com",
    name: "Avery Chen",
  },
  {
    id: "si-as-user-adv-b",
    email: "adviser.b@synthetic.advizorstack.example.com",
    name: "Blake Moretti",
  },
] as const;

/** Extra rollover-documentation flags beyond the primary priority finding (total 7). */
export const ADVIZORSTACK_ROLLOVER_FLAGS = [
  {
    id: "si-as-flag-rollover-001",
    workspaceId: "si-as-ws-secure",
    meetingId: "si-as-sec-mtg-pri-001",
    status: "IN_REMEDIATION" as const,
    withTask: true,
    taskId: "si-as-task-001",
    resolutionId: "si-as-res-001",
    adviserId: "si-as-user-adv-a",
  },
  {
    id: "si-as-flag-rollover-002",
    workspaceId: "si-as-ws-secure",
    meetingId: "si-as-sec-mtg-001",
    status: "IN_REMEDIATION" as const,
    withTask: true,
    taskId: "si-as-task-002",
    resolutionId: "si-as-res-002",
    adviserId: "si-as-user-adv-a",
  },
  {
    id: "si-as-flag-rollover-003",
    workspaceId: "si-as-ws-desert-ridge",
    meetingId: "si-as-drw-mtg-001",
    status: "IN_REMEDIATION" as const,
    withTask: true,
    taskId: "si-as-task-003",
    resolutionId: "si-as-res-003",
    adviserId: "si-as-user-adv-b",
  },
  {
    id: "si-as-flag-rollover-004",
    workspaceId: "si-as-ws-northstar",
    meetingId: "si-as-ns-mtg-001",
    status: "IN_REMEDIATION" as const,
    withTask: true,
    taskId: "si-as-task-004",
    resolutionId: "si-as-res-004",
    adviserId: "si-as-user-adv-b",
  },
  {
    id: "si-as-flag-rollover-005",
    workspaceId: "si-as-ws-secure",
    meetingId: "si-as-sec-mtg-002",
    status: "CLOSED" as const,
    withTask: false,
    taskId: null,
    resolutionId: null,
    adviserId: "si-as-user-adv-a",
  },
  {
    id: "si-as-flag-rollover-006",
    workspaceId: "si-as-ws-desert-ridge",
    meetingId: "si-as-drw-mtg-002",
    status: "CLOSED" as const,
    withTask: false,
    taskId: null,
    resolutionId: null,
    adviserId: "si-as-user-adv-b",
  },
  {
    id: "si-as-flag-rollover-007",
    workspaceId: "si-as-ws-northstar",
    meetingId: "si-as-ns-mtg-002",
    status: "CLOSED" as const,
    withTask: false,
    taskId: null,
    resolutionId: null,
    adviserId: "si-as-user-adv-a",
  },
] as const;

export const ADVIZORSTACK_EXPECTED_COUNTS = {
  totalProcessed: 147,
  clearedOrDeprioritised: 139,
  routineSamples: 5,
  priorityFindings: 3,
  heldInteractions: 0,
  openRemediation: 4,
  rolloverFindings: 7,
  firmsAffected: 3,
  repeatAdvisers: 2,
} as const;

export function isAdvizorStackFirmWorkspaceId(workspaceId: string): boolean {
  return ADVIZORSTACK_FIRMS.some((firm) => firm.workspaceId === workspaceId);
}

export function advizorStackFirmWorkspaceIds(): string[] {
  return ADVIZORSTACK_FIRMS.map((firm) => firm.workspaceId);
}

export function padMeetingIndex(n: number): string {
  return String(n).padStart(3, "0");
}

export function expectedMeetingIdsForFirm(firm: AdvizorStackFirmDef): string[] {
  const ids: string[] = [];
  const routineCount = firm.cleared + firm.sampled;
  for (let i = 1; i <= routineCount; i += 1) {
    ids.push(`${firm.meetingPrefix}${padMeetingIndex(i)}`);
  }
  ids.push(firm.priority.meetingId);
  return ids;
}

export function expectedPortfolioMeetingTotal(): number {
  return ADVIZORSTACK_FIRMS.reduce(
    (sum, firm) => sum + firm.cleared + firm.sampled + 1,
    0,
  );
}
