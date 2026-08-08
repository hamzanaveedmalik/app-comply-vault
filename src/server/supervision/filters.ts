/**
 * CV-SI-005 — global supervision filter contract.
 * URL is the source of truth. Empty query = default 30-day window.
 */

import { z } from "zod";
import type { PriorityInboxTab, SupervisoryOutcome } from "~/lib/types";

export const SUPERVISION_CHANNELS = ["MEETING", "EMAIL"] as const;
export type SupervisionChannel = (typeof SUPERVISION_CHANNELS)[number];

export const SUPERVISION_OUTCOMES = [
  "CLEARED",
  "ROUTINE_SAMPLE",
  "ESCALATED",
  "HELD",
  "PARKED",
] as const satisfies readonly SupervisoryOutcome[];

export const SUPERVISION_SEVERITIES = ["INFO", "WARN", "CRITICAL"] as const;
export type SupervisionSeverity = (typeof SUPERVISION_SEVERITIES)[number];

export const SUPERVISION_FINDING_STATUSES = [
  "OPEN",
  "IN_REMEDIATION",
  "PENDING_VERIFICATION",
  "CLOSED",
  "CLOSED_ACCEPTED_RISK",
] as const;
export type SupervisionFindingStatus =
  (typeof SUPERVISION_FINDING_STATUSES)[number];

export const SUPERVISION_CONTROLS = [
  "MISSING_DISCLOSURE",
  "CONFLICT_LANGUAGE",
  "MISSING_SUITABILITY_BASIS",
  "GUARANTEED_RETURN",
  "PERFORMANCE_CLAIM",
  "CLIENT_COMPLAINT",
  "UNAPPROVED_MARKETING",
  "TRADE_INSTRUCTION",
  "FEE_DISPUTE",
  "OFF_CHANNEL_REFERENCE",
  "SENSITIVE_PII_SHARE",
  "GIFTS_ENTERTAINMENT",
] as const;
export type SupervisionControl = (typeof SUPERVISION_CONTROLS)[number];

export const PRIORITY_INBOX_TABS = [
  "unassigned",
  "assigned",
  "in_review",
  "remediation",
  "escalated",
  "closed",
] as const satisfies readonly PriorityInboxTab[];

export type SupervisionFilterState = {
  dateFrom: string;
  dateTo: string;
  firmId?: string;
  adviserId?: string;
  channel?: SupervisionChannel;
  control?: SupervisionControl;
  outcome?: SupervisoryOutcome;
  severity?: SupervisionSeverity;
  findingStatus?: SupervisionFindingStatus;
  inboxTab?: PriorityInboxTab;
};

export type SupervisionFilterSearchParams = Record<
  string,
  string | string[] | undefined
>;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function includesValue<T extends string>(
  values: readonly T[],
  value: string,
): value is T {
  return values.some((candidate) => candidate === value);
}

const optionalEnum = <T extends string>(values: readonly T[]) =>
  z
    .string()
    .optional()
    .transform((value): T | undefined => {
      if (!value) return undefined;
      return includesValue(values, value) ? value : undefined;
    });

const optionalId = z
  .string()
  .optional()
  .transform((value) => {
    const trimmed = value?.trim() ?? "";
    return trimmed.length > 0 ? trimmed : undefined;
  });

const optionalDate = z
  .string()
  .optional()
  .transform((value) => {
    const trimmed = value?.trim() ?? "";
    return DATE_RE.test(trimmed) ? trimmed : undefined;
  });

const urlFilterSchema = z.object({
  from: optionalDate,
  to: optionalDate,
  firm: optionalId,
  adviser: optionalId,
  channel: optionalEnum(SUPERVISION_CHANNELS),
  control: optionalEnum(SUPERVISION_CONTROLS),
  outcome: optionalEnum(SUPERVISION_OUTCOMES),
  severity: optionalEnum(SUPERVISION_SEVERITIES),
  status: optionalEnum(SUPERVISION_FINDING_STATUSES),
  tab: optionalEnum(PRIORITY_INBOX_TABS),
});

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function toDateOnly(date: Date): string {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

export function startOfUtcDay(dateOnly: string): Date {
  return new Date(`${dateOnly}T00:00:00.000Z`);
}

export function endOfUtcDay(dateOnly: string): Date {
  return new Date(`${dateOnly}T23:59:59.999Z`);
}

export function defaultSupervisionWindow(now: Date = new Date()): {
  dateFrom: string;
  dateTo: string;
} {
  const dateTo = toDateOnly(now);
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  from.setUTCDate(from.getUTCDate() - 29);
  return { dateFrom: toDateOnly(from), dateTo };
}

function firstParam(
  value: string | string[] | undefined,
): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

export function parseSupervisionFilters(
  searchParams: SupervisionFilterSearchParams,
  now: Date = new Date(),
): SupervisionFilterState {
  const raw = {
    from: firstParam(searchParams.from),
    to: firstParam(searchParams.to),
    firm: firstParam(searchParams.firm) ?? firstParam(searchParams.firmId),
    adviser: firstParam(searchParams.adviser) ?? firstParam(searchParams.adviserId),
    channel: firstParam(searchParams.channel),
    control: firstParam(searchParams.control),
    outcome: firstParam(searchParams.outcome),
    severity: firstParam(searchParams.severity),
    status: firstParam(searchParams.status),
    tab: firstParam(searchParams.tab),
  };
  const parsed = urlFilterSchema.parse(raw);
  const fallback = defaultSupervisionWindow(now);
  const dateFrom = parsed.from ?? fallback.dateFrom;
  const dateTo = parsed.to ?? fallback.dateTo;
  const ordered =
    dateFrom <= dateTo
      ? { dateFrom, dateTo }
      : { dateFrom: dateTo, dateTo: dateFrom };

  return {
    ...ordered,
    firmId: parsed.firm,
    adviserId: parsed.adviser,
    channel: parsed.channel,
    control: parsed.control,
    outcome: parsed.outcome,
    severity: parsed.severity,
    findingStatus: parsed.status,
    inboxTab: parsed.tab,
  };
}

export function isDefaultSupervisionWindow(
  filters: Pick<SupervisionFilterState, "dateFrom" | "dateTo">,
  now: Date = new Date(),
): boolean {
  const fallback = defaultSupervisionWindow(now);
  return filters.dateFrom === fallback.dateFrom && filters.dateTo === fallback.dateTo;
}

export function serializeSupervisionFilters(
  filters: SupervisionFilterState,
  now: Date = new Date(),
): URLSearchParams {
  const params = new URLSearchParams();
  if (!isDefaultSupervisionWindow(filters, now)) {
    params.set("from", filters.dateFrom);
    params.set("to", filters.dateTo);
  }
  if (filters.firmId) params.set("firm", filters.firmId);
  if (filters.adviserId) params.set("adviser", filters.adviserId);
  if (filters.channel) params.set("channel", filters.channel);
  if (filters.control) params.set("control", filters.control);
  if (filters.outcome) params.set("outcome", filters.outcome);
  if (filters.severity) params.set("severity", filters.severity);
  if (filters.findingStatus) params.set("status", filters.findingStatus);
  if (filters.inboxTab && filters.inboxTab !== "unassigned") {
    params.set("tab", filters.inboxTab);
  }
  return params;
}

export function supervisionHref(
  pathname: string,
  filters: SupervisionFilterState,
  extra?: Record<string, string | undefined>,
  now: Date = new Date(),
): string {
  const params = serializeSupervisionFilters(filters, now);
  if (extra) {
    for (const [key, value] of Object.entries(extra)) {
      if (value) params.set(key, value);
    }
  }
  const query = params.toString();
  return query.length > 0 ? `${pathname}?${query}` : pathname;
}

export function toSummaryQuery(filters: SupervisionFilterState): {
  dateFrom: Date;
  dateTo: Date;
  firmId?: string;
  adviserId?: string;
  channel?: SupervisionChannel;
  control?: SupervisionControl;
  outcome?: SupervisoryOutcome;
  severity?: SupervisionSeverity;
  findingStatus?: SupervisionFindingStatus;
} {
  return {
    dateFrom: startOfUtcDay(filters.dateFrom),
    dateTo: endOfUtcDay(filters.dateTo),
    firmId: filters.firmId,
    adviserId: filters.adviserId,
    channel: filters.channel,
    control: filters.control,
    outcome: filters.outcome,
    severity: filters.severity,
    findingStatus: filters.findingStatus,
  };
}

export const SUPERVISION_FILTER_LABELS = {
  channel: {
    MEETING: "Meetings",
    EMAIL: "Email",
  } satisfies Record<SupervisionChannel, string>,
  outcome: {
    CLEARED: "Cleared",
    ROUTINE_SAMPLE: "Routine sample",
    ESCALATED: "Escalated",
    HELD: "Held",
    PARKED: "Parked",
  } satisfies Record<SupervisoryOutcome, string>,
  severity: {
    INFO: "Info",
    WARN: "Warn",
    CRITICAL: "Critical",
  } satisfies Record<SupervisionSeverity, string>,
  findingStatus: {
    OPEN: "Open",
    IN_REMEDIATION: "In remediation",
    PENDING_VERIFICATION: "Pending verification",
    CLOSED: "Closed",
    CLOSED_ACCEPTED_RISK: "Closed — accepted risk",
  } satisfies Record<SupervisionFindingStatus, string>,
  inboxTab: {
    unassigned: "Unassigned",
    assigned: "Assigned to me",
    in_review: "In review",
    remediation: "Awaiting remediation",
    escalated: "Escalated",
    closed: "Closed",
  } satisfies Record<PriorityInboxTab, string>,
  control: {
    MISSING_DISCLOSURE: "Rollover / missing disclosure",
    CONFLICT_LANGUAGE: "Conflict language",
    MISSING_SUITABILITY_BASIS: "Missing suitability basis",
    GUARANTEED_RETURN: "Guaranteed return",
    PERFORMANCE_CLAIM: "Performance claim",
    CLIENT_COMPLAINT: "Client complaint",
    UNAPPROVED_MARKETING: "Unapproved marketing",
    TRADE_INSTRUCTION: "Trade instruction",
    FEE_DISPUTE: "Fee disclosure",
    OFF_CHANNEL_REFERENCE: "Off-channel reference",
    SENSITIVE_PII_SHARE: "Sensitive PII share",
    GIFTS_ENTERTAINMENT: "Gifts and entertainment",
  } satisfies Record<SupervisionControl, string>,
} as const;
