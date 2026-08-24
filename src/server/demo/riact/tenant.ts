/**
 * RIACT partner-demo tenant registry — fully isolated from AdvizorStack.
 * Stable IDs and a fixed reference date keep seeds idempotent and answers deterministic.
 */

export const RIACT_ONBOARDING_TYPE = "SYNTHETIC_RIACT" as const;

/** Fixed "today" for all seeded timestamps and demo answers. */
export const RIACT_REFERENCE_DATE_ISO = "2026-08-23T12:00:00.000Z";

export const RIACT_DEMO_ROUTE = "/demo/riact" as const;

export const RIACT_DEMO_USER = {
  id: "riact-user-cco-001",
  email: "cco.demo@riact.synthetic.example.com",
  name: "Jordan Keene",
  /** Seeded locally only — never commit real credentials. */
  password: "RiactDemo2026!",
} as const;

export type RiactFirmDef = {
  workspaceId: string;
  firmProfileId: string;
  name: string;
  crdNumber: string;
  ccoName: string;
  aumUsd: number;
  registration: "SEC" | "STATE";
  adviserCount: number;
  /** Primary firm — all evidence corpus lives here. */
  primary: boolean;
};

export const RIACT_PARENT_PRACTICE = {
  workspaceId: "riact-ws-sonoran",
  name: "Sonoran Compliance Partners",
  firmProfileId: "riact-fp-sonoran",
  crdNumber: "RC-9000",
  ccoName: RIACT_DEMO_USER.name,
} as const;

export const RIACT_CLIENT_FIRMS: readonly RiactFirmDef[] = [
  {
    workspaceId: "riact-ws-cactus",
    firmProfileId: "riact-fp-cactus",
    name: "Cactus Wren Advisory",
    crdNumber: "RC-3101",
    ccoName: "Elena Morales",
    aumUsd: 310_000_000,
    registration: "SEC",
    adviserCount: 4,
    primary: true,
  },
  {
    workspaceId: "riact-ws-vermillion",
    firmProfileId: "riact-fp-vermillion",
    name: "Vermillion Cliffs Wealth",
    crdNumber: "RC-9501",
    ccoName: "Marcus Hale",
    aumUsd: 95_000_000,
    registration: "STATE",
    adviserCount: 3,
    primary: false,
  },
  {
    workspaceId: "riact-ws-pinal",
    firmProfileId: "riact-fp-pinal",
    name: "Pinal Ridge Capital",
    crdNumber: "RC-1401",
    ccoName: "Priya Shah",
    aumUsd: 140_000_000,
    registration: "STATE",
    adviserCount: 4,
    primary: false,
  },
] as const;

/** Advisors on the primary firm (Cactus Wren) — drives the dashboard Advisors table. */
export const RIACT_ADVISORS = [
  {
    id: "riact-user-adv-elena",
    email: "elena.morales@riact.synthetic.example.com",
    name: "Elena Morales",
  },
  {
    id: "riact-user-adv-derek",
    email: "derek.cho@riact.synthetic.example.com",
    name: "Derek Cho",
  },
  {
    id: "riact-user-adv-amira",
    email: "amira.hassan@riact.synthetic.example.com",
    name: "Amira Hassan",
  },
  {
    id: "riact-user-adv-noah",
    email: "noah.bennett@riact.synthetic.example.com",
    name: "Noah Bennett",
  },
] as const;

/** Primary demo client for SEC document request and rehearsed Ask moments. */
export const RIACT_PRIMARY_CLIENT = {
  id: "riact-client-marcus-holloway",
  name: "Marcus Holloway",
  email: "marcus.holloway@example.com",
} as const;

/** Inbound SEC document request letter (~10 days before reference date). */
export const RIACT_SEC_DOCUMENT_REQUEST = {
  id: "riact-doc-sec-request-001",
  occurredAtIso: "2026-08-13T16:00:00.000Z",
  title: "SEC document request — Marcus Holloway",
  body: `Division of Examinations
U.S. Securities and Exchange Commission

Re: Cactus Wren Advisory (CRD ${RIACT_CLIENT_FIRMS[0]!.crdNumber})
Request dated 13 August 2026

Please produce all advisory-fee communications and suitability documentation for client Marcus Holloway for the twelve-month period ending 13 August 2026, including email and meeting records under your supervision.

Respond within fifteen business days.`,
  requestItemText:
    "Produce all advisory-fee communications and suitability documentation for Marcus Holloway for the twelve-month period ending 13 August 2026, including email and meeting records.",
} as const;

/** Indexed email corpus window — nine months ending at reference date. */
export const RIACT_CORPUS_FROM_ISO = "2025-11-23T00:00:00.000Z";
export const RIACT_CORPUS_TO_ISO = RIACT_REFERENCE_DATE_ISO;

/** Twelve-month request window vs nine-month corpus → earliest three months unavailable. */
export const RIACT_COVERAGE_GAP = {
  from: "2025-08-13",
  to: "2025-11-22",
  reason:
    "Indexed mailbox and meeting capture begin 23 November 2025 — request covers twelve months",
} as const;

export const RIACT_SMS_SOURCE = {
  id: "riact-sms-source-001",
  name: "SMS",
  reason: "SMS/text channel registered but not indexed for Ask retrieval",
  displayLabel: "Cactus Wren SMS archive (unindexed)",
} as const;

/** Fail-closed Ask — answer depends on unindexed SMS only. */
export const RIACT_SMS_REFUSAL_QUESTION =
  "What did Marcus Holloway say over SMS about the 401(k) rollover?" as const;

/** Grounded Ask — answerable from indexed email corpus with hash citations. */
export const RIACT_CITATION_QUESTION =
  "What advisory fee discussions did we have with Marcus Holloway by email?" as const;

export const RIACT_MAILBOX = {
  connectionId: "riact-mailbox-cactus-001",
  address: "compliance@cactuswren.demo.example.com",
} as const;

export function isRiactWorkspaceId(workspaceId: string): boolean {
  if (workspaceId === RIACT_PARENT_PRACTICE.workspaceId) return true;
  return RIACT_CLIENT_FIRMS.some((firm) => firm.workspaceId === workspaceId);
}

export function isRiactClientFirmWorkspaceId(workspaceId: string): boolean {
  return RIACT_CLIENT_FIRMS.some((firm) => firm.workspaceId === workspaceId);
}

export function riactPrimaryWorkspaceId(): string {
  return RIACT_CLIENT_FIRMS.find((f) => f.primary)!.workspaceId;
}

export function riactClientFirmWorkspaceIds(): string[] {
  return RIACT_CLIENT_FIRMS.map((firm) => firm.workspaceId);
}
