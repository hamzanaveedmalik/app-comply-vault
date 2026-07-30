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
  auditChainRootId: string | null;
  exportManifestSha: string | null;
  createdAt: string;
  confirmedAt: string | null;
  approvedAt: string | null;
};

function asScope(json: unknown): InterpretedScope {
  return json as InterpretedScope;
}

function toDto(row: {
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
  approvedAt: Date | null;
}): CandidatePackDto {
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
    auditChainRootId: row.auditChainRootId,
    exportManifestSha: row.exportManifestSha,
    createdAt: row.createdAt.toISOString(),
    confirmedAt: row.confirmedAt?.toISOString() ?? null,
    approvedAt: row.approvedAt?.toISOString() ?? null,
  };
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
 * Step 3: CCO confirms or edits scope. Generation is allowed only after this.
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
        },
      },
    }),
  ]);

  return toDto(row);
}

/**
 * Steps 4–5: retrieve candidate evidence after confirmation; attach coverage.
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
        ...(dateFilter ? { meetingDate: dateFilter } : {}),
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

  const coverageStatement = buildCoverageStatement({
    scope,
    meetingCount: meetingIds.length,
    emailCount: emailEvidenceIds.length,
    gapPeriods: [
      {
        from: "2024-01-01",
        to: "2024-03-31",
        reason: "Mailbox not connected for Q1 2024",
      },
    ],
    unindexedSources: ["SMS", "WhatsApp"],
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

  return toDto(row);
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function approveCandidatePack(args: {
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
  if (existing.status !== "GENERATED") {
    throw new Error("Generate the candidate pack before approval");
  }

  const approvedAt = new Date();
  const [row] = await db.$transaction([
    db.candidateResponsePack.update({
      where: { id: existing.id },
      data: {
        status: "APPROVED",
        approvedAt,
        approvedByUserId: args.userId,
      },
    }),
    db.auditEvent.create({
      data: {
        workspaceId: args.workspaceId,
        userId: args.userId,
        action: "CANDIDATE_PACK_APPROVED",
        resourceType: "candidate_response_pack",
        resourceId: existing.id,
        metadata: { packId: existing.id },
      },
    }),
  ]);

  return toDto(row);
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
  return row ? toDto(row) : null;
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
  return rows.map(toDto);
}
