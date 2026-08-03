/**
 * CV-XR-01a/01b — Candidate Response Pack service.
 * Nothing generates before stored CCO scope confirmation.
 */

import { db } from "~/server/db";
import type { Prisma } from "../../../generated/prisma";
import {
  assertNoExamReadyClaim,
  buildCoverageStatement,
  interpretRequestItem,
  type CandidateEvidenceRow,
  type ConfirmedScope,
  type CoverageStatementItem,
  type InterpretedScope,
} from "./types";

export type CandidatePackDto = {
  id: string;
  workspaceId: string;
  requestText: string;
  interpretedScope: InterpretedScope;
  confirmedScope: ConfirmedScope | null;
  status: string;
  coverageStatement: CoverageStatementItem[] | null;
  retrievalBasis: string | null;
  meetingIds: string[];
  emailEvidenceIds: string[];
  candidateRecords: CandidateEvidenceRow[];
  auditChainRootId: string | null;
  exportManifestSha: string | null;
  createdAt: string;
  confirmedAt: string | null;
  confirmedByUserId: string | null;
  approvedAt: string | null;
  approvedByUserId: string | null;
};

function asScope(json: unknown): InterpretedScope {
  return json as InterpretedScope;
}

function toDto(
  row: {
    id: string;
    workspaceId: string;
    requestText: string;
    interpretedScope: unknown;
    confirmedScope: unknown;
    status: string;
    coverageStatement: unknown;
    retrievalBasis: string | null;
    meetingIds: string[];
    emailEvidenceIds: string[];
    auditChainRootId: string | null;
    exportManifestSha: string | null;
    createdAt: Date;
    confirmedAt: Date | null;
    confirmedByUserId: string | null;
    approvedAt: Date | null;
    approvedByUserId: string | null;
  },
  candidateRecords: CandidateEvidenceRow[] = []
): CandidatePackDto {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    requestText: row.requestText,
    interpretedScope: asScope(row.interpretedScope),
    confirmedScope: (row.confirmedScope as ConfirmedScope | null) ?? null,
    status: row.status,
    coverageStatement:
      (row.coverageStatement as CoverageStatementItem[] | null) ?? null,
    retrievalBasis: row.retrievalBasis,
    meetingIds: row.meetingIds,
    emailEvidenceIds: row.emailEvidenceIds,
    candidateRecords,
    auditChainRootId: row.auditChainRootId,
    exportManifestSha: row.exportManifestSha,
    createdAt: row.createdAt.toISOString(),
    confirmedAt: row.confirmedAt?.toISOString() ?? null,
    confirmedByUserId: row.confirmedByUserId,
    approvedAt: row.approvedAt?.toISOString() ?? null,
    approvedByUserId: row.approvedByUserId,
  };
}

function hashPrefix(value: string | null | undefined): string | null {
  if (!value) return null;
  return value.slice(0, 12);
}

function matchesAny(haystack: string, needles: string[]): boolean {
  const lower = haystack.toLowerCase();
  return needles.some((n) => lower.includes(n.toLowerCase()));
}

async function hydrateCandidateRecords(args: {
  workspaceId: string;
  scope: InterpretedScope;
  meetingIds: string[];
  emailEvidenceIds: string[];
}): Promise<CandidateEvidenceRow[]> {
  const rows: CandidateEvidenceRow[] = [];
  const people = args.scope.people;
  const concepts = args.scope.concepts;

  if (args.meetingIds.length > 0) {
    const meetings = await db.meeting.findMany({
      where: {
        workspaceId: args.workspaceId,
        id: { in: args.meetingIds },
      },
      select: {
        id: true,
        clientName: true,
        meetingType: true,
        meetingDate: true,
        searchableText: true,
        transcriptSha256: true,
        sourceFileSha256: true,
      },
    });
    for (const m of meetings) {
      const reasons: string[] = [];
      if (people.length && matchesAny(m.clientName, people)) {
        reasons.push(`participant match (${m.clientName})`);
      } else if (
        people.length &&
        m.searchableText &&
        matchesAny(m.searchableText, people)
      ) {
        reasons.push("name mentioned in transcript index");
      }
      if (
        concepts.length &&
        m.searchableText &&
        matchesAny(m.searchableText, concepts)
      ) {
        reasons.push(`concept match (${concepts.join(", ")})`);
      }
      if (reasons.length === 0) {
        reasons.push("within confirmed channels and date range");
      }
      rows.push({
        id: m.id,
        kind: "MEETING",
        occurredAt: m.meetingDate.toISOString(),
        title: m.clientName,
        subtitle: m.meetingType,
        sourceSystem: "Meeting capture",
        hashPrefix: hashPrefix(m.transcriptSha256 ?? m.sourceFileSha256),
        matchReason: reasons.join("; "),
      });
    }
  }

  if (args.emailEvidenceIds.length > 0) {
    const emails = await db.evidenceItem.findMany({
      where: {
        workspaceId: args.workspaceId,
        id: { in: args.emailEvidenceIds },
        deletedAt: null,
      },
      select: {
        id: true,
        title: true,
        occurredAt: true,
        contentSha256: true,
        searchableText: true,
        communication: {
          select: { fromAddress: true, bodyText: true },
        },
      },
    });
    for (const e of emails) {
      const blob = [
        e.title,
        e.searchableText ?? "",
        e.communication?.bodyText ?? "",
        e.communication?.fromAddress ?? "",
      ].join(" ");
      const reasons: string[] = [];
      if (people.length && matchesAny(blob, people)) {
        reasons.push("participant or name match");
      }
      if (concepts.length && matchesAny(blob, concepts)) {
        reasons.push(`concept match (${concepts.join(", ")})`);
      }
      if (reasons.length === 0) {
        reasons.push("within confirmed channels and date range");
      }
      rows.push({
        id: e.id,
        kind: "EMAIL",
        occurredAt: e.occurredAt.toISOString(),
        title: e.title,
        subtitle: e.communication?.fromAddress ?? "Email",
        sourceSystem: "Mailbox",
        hashPrefix: hashPrefix(e.contentSha256),
        matchReason: reasons.join("; "),
      });
    }
  }

  rows.sort((a, b) => {
    const at = a.occurredAt ?? "";
    const bt = b.occurredAt ?? "";
    return bt.localeCompare(at);
  });
  return rows;
}

/** Step 1–2: paste request → show interpretation. No generation yet. */
export async function createCandidatePackDraft(args: {
  workspaceId: string;
  requestText: string;
  userId: string;
}): Promise<CandidatePackDto> {
  const text = args.requestText.trim();
  if (text.length < 10) {
    throw new Error("Request item text is too short");
  }
  if (!assertNoExamReadyClaim(text)) {
    throw new Error("Request text must not claim exam readiness");
  }

  const interpretedScope = interpretRequestItem(text);
  const row = await db.candidateResponsePack.create({
    data: {
      workspaceId: args.workspaceId,
      requestText: text,
      interpretedScope: interpretedScope as unknown as Prisma.InputJsonValue,
      status: "DRAFT_SCOPE",
    },
  });
  return toDto(row);
}

/**
 * CCO confirms or edits scope. Generation is allowed only after this.
 */
export async function confirmCandidatePackScope(args: {
  workspaceId: string;
  packId: string;
  userId: string;
  scope: InterpretedScope;
}): Promise<CandidatePackDto> {
  const existing = await db.candidateResponsePack.findFirst({
    where: {
      id: args.packId,
      workspaceId: args.workspaceId,
      deletedAt: null,
    },
  });
  if (!existing) {
    throw new Error("Candidate pack not found");
  }
  if (existing.status !== "DRAFT_SCOPE") {
    throw new Error("Scope already confirmed");
  }

  const confirmedAt = new Date();
  const confirmedScope: ConfirmedScope = {
    ...args.scope,
    confirmedAt: confirmedAt.toISOString(),
    confirmedByUserId: args.userId,
  };

  const [row] = await db.$transaction([
    db.candidateResponsePack.update({
      where: { id: existing.id },
      data: {
        confirmedScope: confirmedScope as unknown as Prisma.InputJsonValue,
        interpretedScope: args.scope as unknown as Prisma.InputJsonValue,
        confirmedAt,
        confirmedByUserId: args.userId,
        status: "SCOPE_CONFIRMED",
      },
    }),
    db.auditEvent.create({
      data: {
        workspaceId: args.workspaceId,
        userId: args.userId,
        action: "CANDIDATE_PACK_SCOPE_CONFIRMED",
        resourceType: "candidate_response_pack",
        resourceId: existing.id,
        metadata: {
          packId: existing.id,
          channels: args.scope.channels,
          dateFrom: args.scope.dateFrom,
          dateTo: args.scope.dateTo,
          exclusions: args.scope.exclusions,
          people: args.scope.people,
        },
      },
    }),
  ]);

  return toDto(row);
}

/**
 * Retrieve candidate evidence after confirmation; attach coverage.
 */
export async function generateCandidatePack(args: {
  workspaceId: string;
  packId: string;
  userId: string;
}): Promise<CandidatePackDto> {
  const existing = await db.candidateResponsePack.findFirst({
    where: {
      id: args.packId,
      workspaceId: args.workspaceId,
      deletedAt: null,
    },
  });
  if (!existing) {
    throw new Error("Candidate pack not found");
  }
  if (
    existing.status !== "SCOPE_CONFIRMED" &&
    existing.status !== "GENERATED"
  ) {
    throw new Error("Confirm scope before generating the candidate pack");
  }

  const scope = (existing.confirmedScope ??
    existing.interpretedScope) as InterpretedScope;

  const dateFilter =
    scope.dateFrom && ISO_DATE.test(scope.dateFrom)
      ? {
          gte: new Date(`${scope.dateFrom}T00:00:00.000Z`),
          ...(scope.dateTo && ISO_DATE.test(scope.dateTo)
            ? { lte: new Date(`${scope.dateTo}T23:59:59.999Z`) }
            : {}),
        }
      : undefined;

  let meetingIds: string[] = [];
  let emailEvidenceIds: string[] = [];

  if (scope.channels.includes("MEETING")) {
    const meetings = await db.meeting.findMany({
      where: {
        workspaceId: args.workspaceId,
        status: { in: ["DRAFT_READY", "FINALIZED"] },
        NOT: { searchableText: "prior engagement archived demo reseed" },
        ...(dateFilter ? { meetingDate: dateFilter } : {}),
        ...(scope.people.length > 0
          ? {
              OR: scope.people.flatMap((p) => [
                { clientName: { contains: p, mode: "insensitive" as const } },
                {
                  searchableText: {
                    contains: p,
                    mode: "insensitive" as const,
                  },
                },
              ]),
            }
          : {}),
      },
      select: { id: true },
      take: 100,
      orderBy: { meetingDate: "desc" },
    });
    meetingIds = meetings.map((m) => m.id);
  }

  if (scope.channels.includes("EMAIL")) {
    const emails = await db.evidenceItem.findMany({
      where: {
        workspaceId: args.workspaceId,
        sourceType: "EMAIL",
        deletedAt: null,
        ...(dateFilter ? { occurredAt: dateFilter } : {}),
        ...(scope.people.length > 0 || scope.concepts.length > 0
          ? {
              OR: [
                ...scope.people.map((p) => ({
                  searchableText: {
                    contains: p,
                    mode: "insensitive" as const,
                  },
                })),
                ...scope.concepts.map((c) => ({
                  searchableText: {
                    contains: c,
                    mode: "insensitive" as const,
                  },
                })),
                ...scope.people.map((p) => ({
                  title: { contains: p, mode: "insensitive" as const },
                })),
              ],
            }
          : {}),
      },
      select: { id: true },
      take: 100,
      orderBy: { occurredAt: "desc" },
    });
    emailEvidenceIds = emails.map((e) => e.id);
  }

  const chainRoot = await db.auditEvent.findFirst({
    where: { workspaceId: args.workspaceId },
    orderBy: { timestamp: "asc" },
    select: { id: true },
  });

  const coverageManifest = await db.indexCoverageManifest.findUnique({
    where: { workspaceId: args.workspaceId },
    select: { gapPeriods: true, unindexedSources: true },
  });
  const gapPeriods = (
    (coverageManifest?.gapPeriods as Array<{
      from: string;
      to: string;
      reason?: string;
    }> | null) ?? []
  ).map((g) => ({
    from: g.from,
    to: g.to,
    reason: g.reason ?? "Indexed coverage gap",
  }));
  const unindexedSources = (
    (coverageManifest?.unindexedSources as Array<{ name: string }> | null) ??
    []
  ).map((u) => u.name);

  const coverageStatement = buildCoverageStatement({
    scope,
    meetingCount: meetingIds.length,
    emailCount: emailEvidenceIds.length,
    gapPeriods: gapPeriods.length
      ? gapPeriods
      : [
          {
            from: "2024-01-01",
            to: "2024-03-31",
            reason: "Mailbox not connected for Q1 2024",
          },
        ],
    unindexedSources: unindexedSources.length
      ? unindexedSources
      : ["SMS", "WhatsApp", "Teams chat"],
  });

  for (const item of coverageStatement) {
    if (!assertNoExamReadyClaim(item.detail)) {
      throw new Error("Coverage statement must not claim exam readiness");
    }
  }

  const retrievalBasis = [
    "Candidate retrieval under confirmed scope only.",
    `Meetings: ${meetingIds.length}. Email evidence items: ${emailEvidenceIds.length}.`,
    "Pack labelled candidate — CCO approval required before export use.",
  ].join(" ");

  const [row] = await db.$transaction([
    db.candidateResponsePack.update({
      where: { id: existing.id },
      data: {
        status: "GENERATED",
        meetingIds,
        emailEvidenceIds,
        coverageStatement:
          coverageStatement as unknown as Prisma.InputJsonValue,
        retrievalBasis,
        auditChainRootId: chainRoot?.id ?? null,
      },
    }),
    db.auditEvent.create({
      data: {
        workspaceId: args.workspaceId,
        userId: args.userId,
        action: "CANDIDATE_PACK_GENERATED",
        resourceType: "candidate_response_pack",
        resourceId: existing.id,
        metadata: {
          packId: existing.id,
          meetingCount: meetingIds.length,
          emailCount: emailEvidenceIds.length,
          auditChainRootId: chainRoot?.id ?? null,
        },
      },
    }),
  ]);

  const candidateRecords = await hydrateCandidateRecords({
    workspaceId: args.workspaceId,
    scope,
    meetingIds,
    emailEvidenceIds,
  });

  return toDto(row, candidateRecords);
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export type ApproveCandidatePackInput = {
  workspaceId: string;
  packId: string;
  userId: string;
  includedMeetingIds: string[];
  includedEmailEvidenceIds: string[];
  acknowledgedCoverageLabels: string[];
};

export async function approveCandidatePack(
  args: ApproveCandidatePackInput
): Promise<CandidatePackDto> {
  const existing = await db.candidateResponsePack.findFirst({
    where: {
      id: args.packId,
      workspaceId: args.workspaceId,
      deletedAt: null,
    },
  });
  if (!existing) {
    throw new Error("Candidate pack not found");
  }
  if (existing.status !== "GENERATED") {
    throw new Error("Generate the candidate pack before approval");
  }

  const coverage =
    (existing.coverageStatement as CoverageStatementItem[] | null) ?? [];
  const requiredLabels = coverage.map((c) => c.label);
  for (const label of requiredLabels) {
    if (!args.acknowledgedCoverageLabels.includes(label)) {
      throw new Error(
        "Acknowledge every coverage item before approving the candidate pack"
      );
    }
  }

  const meetingIds = args.includedMeetingIds.filter((id) =>
    existing.meetingIds.includes(id)
  );
  const emailEvidenceIds = args.includedEmailEvidenceIds.filter((id) =>
    existing.emailEvidenceIds.includes(id)
  );

  const approvedAt = new Date();
  const scope = (existing.confirmedScope ??
    existing.interpretedScope) as InterpretedScope;
  const [row] = await db.$transaction([
    db.candidateResponsePack.update({
      where: { id: existing.id },
      data: {
        status: "APPROVED",
        approvedAt,
        approvedByUserId: args.userId,
        meetingIds,
        emailEvidenceIds,
      },
    }),
    db.auditEvent.create({
      data: {
        workspaceId: args.workspaceId,
        userId: args.userId,
        action: "CANDIDATE_PACK_APPROVED",
        resourceType: "candidate_response_pack",
        resourceId: existing.id,
        metadata: {
          packId: existing.id,
          approvedByUserId: args.userId,
          approvedAt: approvedAt.toISOString(),
          scopeConfirmedAt: existing.confirmedAt?.toISOString() ?? null,
          scopeConfirmedByUserId: existing.confirmedByUserId,
          recordCount: meetingIds.length + emailEvidenceIds.length,
          meetingCount: meetingIds.length,
          emailCount: emailEvidenceIds.length,
          acknowledgedCoverage: args.acknowledgedCoverageLabels,
          coverageStatement: coverage,
          confirmedScope: scope,
        },
      },
    }),
  ]);

  const candidateRecords = await hydrateCandidateRecords({
    workspaceId: args.workspaceId,
    scope,
    meetingIds,
    emailEvidenceIds,
  });

  return toDto(row, candidateRecords);
}

export async function getCandidatePack(args: {
  workspaceId: string;
  packId: string;
}): Promise<CandidatePackDto | null> {
  const row = await db.candidateResponsePack.findFirst({
    where: {
      id: args.packId,
      workspaceId: args.workspaceId,
      deletedAt: null,
    },
  });
  if (!row) return null;
  const scope = (row.confirmedScope ?? row.interpretedScope) as InterpretedScope;
  const candidateRecords =
    row.meetingIds.length + row.emailEvidenceIds.length > 0
      ? await hydrateCandidateRecords({
          workspaceId: args.workspaceId,
          scope,
          meetingIds: row.meetingIds,
          emailEvidenceIds: row.emailEvidenceIds,
        })
      : [];
  return toDto(row, candidateRecords);
}

export async function listOpenCandidatePacks(
  workspaceId: string
): Promise<CandidatePackDto[]> {
  const rows = await db.candidateResponsePack.findMany({
    where: {
      workspaceId,
      deletedAt: null,
      status: { in: ["DRAFT_SCOPE", "SCOPE_CONFIRMED", "GENERATED"] },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return rows.map((row) => toDto(row));
}
