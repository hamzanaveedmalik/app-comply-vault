/**
 * CV-Q-01m — Needs Attention surface (severity then age).
 * Reads ComplianceItem via adapters only.
 */

import { db } from "~/server/db";
import {
  complianceItemFromCandidatePack,
  complianceItemFromFlag,
  complianceItemFromHeldIdentity,
  complianceItemFromParkedIngest,
  sortComplianceItems,
} from "~/server/evidence/compliance-item";
import type { ComplianceItem } from "~/server/evidence/types";
import { listOpenCandidatePacks } from "~/server/candidate-pack/service";

export async function listNeedsAttention(
  workspaceId: string,
  now: Date = new Date()
): Promise<ComplianceItem[]> {
  const [flags, parked, triage, meetingsHeld, packs] = await Promise.all([
    db.flag.findMany({
      where: {
        workspaceId,
        status: { in: ["OPEN", "IN_REMEDIATION", "PENDING_VERIFICATION"] },
      },
      orderBy: { createdAt: "asc" },
      take: 50,
    }),
    db.parkedIngest.findMany({
      where: {
        workspaceId,
        deletedAt: null,
        status: { in: ["PARKED", "REPLAY_REQUESTED"] },
      },
      orderBy: { parkedAt: "asc" },
      take: 50,
    }),
    db.emailTriageItem.findMany({
      where: {
        workspaceId,
        status: "PENDING",
      },
      orderBy: { createdAt: "asc" },
      take: 50,
      select: {
        id: true,
        workspaceId: true,
        address: true,
        createdAt: true,
      },
    }),
    db.meeting.findMany({
      where: {
        workspaceId,
        OR: [
          { clientId: null },
          { clientMatchConfidence: "NAME_EXACT" },
        ],
      },
      orderBy: { meetingDate: "desc" },
      take: 30,
      select: {
        id: true,
        workspaceId: true,
        clientName: true,
        clientId: true,
        clientMatchConfidence: true,
        createdAt: true,
      },
    }),
    listOpenCandidatePacks(workspaceId).catch(() => []),
  ]);

  const items: ComplianceItem[] = [];

  for (const f of flags) {
    items.push(complianceItemFromFlag(f, now));
  }
  for (const p of parked) {
    items.push(
      complianceItemFromParkedIngest(
        {
          id: p.id,
          workspaceId: p.workspaceId,
          status: p.status,
          source: p.source,
          createdAt: p.parkedAt,
          parkedAt: p.parkedAt,
        },
        now
      )
    );
  }
  for (const t of triage) {
    items.push(
      complianceItemFromHeldIdentity(
        {
          id: t.id,
          workspaceId: t.workspaceId,
          addressOrName: t.address,
          method: "exact_email",
          confidence: "none",
          createdAt: t.createdAt,
        },
        now
      )
    );
  }
  for (const m of meetingsHeld) {
    items.push(
      complianceItemFromHeldIdentity(
        {
          id: m.id,
          workspaceId: m.workspaceId,
          addressOrName: m.clientName,
          method:
            m.clientMatchConfidence === "NAME_EXACT"
              ? "name_exact_held"
              : "unmatched",
          confidence: "low",
          createdAt: m.createdAt,
          meetingId: m.id,
        },
        now
      )
    );
  }
  for (const pack of packs) {
    items.push(
      complianceItemFromCandidatePack(
        {
          id: pack.id,
          workspaceId: pack.workspaceId,
          requestText: pack.requestText,
          status: pack.status,
          createdAt: new Date(pack.createdAt),
          confirmedAt: pack.confirmedAt
            ? new Date(pack.confirmedAt)
            : null,
        },
        now
      )
    );
  }

  return sortComplianceItems(items);
}
