/**
 * Partner-demo reseed: clean synthetic clients, healthy metrics, non-customer CRD.
 *
 * Soft-deletes compliance records where the schema supports `deletedAt`.
 * Meetings/Flags have no soft-delete — they are healed in place (finalized / closed).
 *
 * Usage:
 *   npx tsx scripts/seed-demo.ts --workspace=<workspaceId> --confirm
 *
 * Optional:
 *   DATABASE_URL=... npx tsx scripts/seed-demo.ts --workspace=... --confirm
 *
 * Pre-tested Ask questions after seed (do not improvise live):
 *   1. "Show me every email where a client mentioned fees since April"
 *   2. "Has any advisor promised performance in writing?"
 *   3. "When did we last hear from Margaret Ellison and about what?"
 */

import crypto from "node:crypto";
import { config } from "dotenv";
import ws from "ws";
import { neonConfig, Pool } from "@neondatabase/serverless";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "../generated/prisma/index.js";

config();

// Local/corporate TLS MitM breaks Prisma's built-in engine; Neon WS adapter works.
neonConfig.webSocketConstructor = ws;
neonConfig.pipelineConnect = false;

const DEMO_FIRM = {
  workspaceName: "A Small Investment, LLC",
  crdNumber: "332816",
  ccoName: "André J. Small",
  aumUsd: 8_400_000,
} as const;

type SyntheticClient = {
  name: string;
  email: string;
  feeBody: string;
  lastTopic: string;
};

const SYNTHETIC_CLIENTS: SyntheticClient[] = [
  {
    name: "Margaret Ellison",
    email: "margaret.ellison@example.com",
    feeBody:
      "Hi team - I am unhappy about what we charge. The 1.25% advisory fee feels high versus last year. Can we revisit the fee schedule before the April review?",
    lastTopic: "quarterly portfolio rebalance and tax-loss harvesting plan",
  },
  {
    name: "James Whitfield",
    email: "james.whitfield@example.com",
    feeBody:
      "Confirming I received the fee disclosure. Comfortable with the tier update effective June 1.",
    lastTopic: "IRA contribution timing for the current tax year",
  },
  {
    name: "Priya Natarajan",
    email: "priya.natarajan@example.com",
    feeBody:
      "Please send the updated Form CRS and fee brochure before our next call.",
    lastTopic: "college funding scenario for 529 contributions",
  },
  {
    name: "Daniel Okonkwo",
    email: "daniel.okonkwo@example.com",
    feeBody:
      "Following up on the invoice - the advisory fee line looks correct for Q2.",
    lastTopic: "risk tolerance questionnaire refresh",
  },
  {
    name: "Elena Vargas",
    email: "elena.vargas@example.com",
    feeBody:
      "Thanks for clarifying the wrap-fee vs transaction fee difference in writing.",
    lastTopic: "estate planning coordination with outside counsel",
  },
];

const PERFORMANCE_EMAIL = {
  clientName: "James Whitfield",
  subject: "Market outlook note",
  body: "Quick note in writing: we cannot promise or guarantee investment performance. Past results do not ensure future returns. Happy to walk through scenarios on our next call.",
};

function parseArgs(argv: string[]): {
  workspaceId: string | null;
  confirm: boolean;
} {
  let workspaceId: string | null = null;
  let confirm = false;
  for (const arg of argv) {
    if (arg.startsWith("--workspace=")) {
      workspaceId = arg.slice("--workspace=".length).trim() || null;
    } else if (arg === "--confirm") {
      confirm = true;
    }
  }
  return { workspaceId, confirm };
}

function daysAgo(days: number, hour = 14): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  d.setUTCHours(hour, 0, 0, 0);
  return d;
}

function sha256(text: string): string {
  return crypto.createHash("sha256").update(text, "utf8").digest("hex");
}

function emailSearchable(subject: string, body: string): string {
  return `${subject} ${body}`.replace(/\s+/g, " ").trim().toLowerCase();
}

async function main(): Promise<void> {
  const { workspaceId, confirm } = parseArgs(process.argv.slice(2));
  if (!workspaceId || !confirm) {
    console.error(
      "Usage: npx tsx scripts/seed-demo.ts --workspace=<id> --confirm"
    );
    process.exit(1);
  }

  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaNeon(pool);
  const prisma = new PrismaClient({ adapter });
  const now = new Date();

  try {
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { id: true, name: true },
    });
    if (!workspace) {
      console.error(`Workspace not found: ${workspaceId}`);
      process.exit(1);
    }

    console.log(`Seeding demo workspace: ${workspace.name} (${workspace.id})`);

    const softDeletedAt = now;

    // ── Soft-delete junk + all prior correspondence (immutable soft-delete) ──
    const evidenceRows = await prisma.evidenceItem.findMany({
      where: { workspaceId, deletedAt: null },
      select: {
        id: true,
        title: true,
        searchableText: true,
        communication: { select: { id: true, bodyText: true, threadId: true } },
      },
    });

    const evidenceToSoftDelete = evidenceRows; // full correspondence reseed for partner demo

    const evidenceIds = evidenceToSoftDelete.map((e) => e.id);
    const threadIds = [
      ...new Set(
        evidenceToSoftDelete
          .map((e) => e.communication?.threadId)
          .filter((id): id is string => Boolean(id))
      ),
    ];
    const communicationIds = evidenceToSoftDelete
      .map((e) => e.communication?.id)
      .filter((id): id is string => Boolean(id));

    if (communicationIds.length > 0) {
      await prisma.communication.updateMany({
        where: { id: { in: communicationIds }, deletedAt: null },
        data: { deletedAt: softDeletedAt },
      });
    }
    if (threadIds.length > 0) {
      await prisma.communicationThread.updateMany({
        where: { id: { in: threadIds }, deletedAt: null },
        data: { deletedAt: softDeletedAt },
      });
    }
    if (evidenceIds.length > 0) {
      await prisma.evidenceItem.updateMany({
        where: { id: { in: evidenceIds }, deletedAt: null },
        data: { deletedAt: softDeletedAt },
      });
    }

    await prisma.emailTriageItem.deleteMany({ where: { workspaceId } });
    await prisma.emailAlias.updateMany({
      where: { workspaceId, deletedAt: null },
      data: { deletedAt: softDeletedAt },
    });
    await prisma.clientActivity.updateMany({
      where: { workspaceId, deletedAt: null },
      data: { deletedAt: softDeletedAt },
    });
    await prisma.client.updateMany({
      where: { workspaceId, deletedAt: null },
      data: { deletedAt: softDeletedAt },
    });

    // Soft-delete test Gmail connection display (OAuth row retained but hidden)
    await prisma.mailboxConnection.updateMany({
      where: {
        workspaceId,
        deletedAt: null,
        mailboxAddress: { contains: "complyvaultco", mode: "insensitive" },
      },
      data: { deletedAt: softDeletedAt },
    });

    // ── Heal metrics: close stale flags, finalize meetings ──
    await prisma.flag.updateMany({
      where: {
        workspaceId,
        status: { in: ["OPEN", "IN_REMEDIATION", "PENDING_VERIFICATION"] },
      },
      data: {
        status: "CLOSED",
        resolvedAt: daysAgo(1),
        resolutionType: "ADD_CONTEXT",
        resolutionNote: "Demo reseed - closed for healthy queue metrics",
      },
    });

    const meetings = await prisma.meeting.findMany({
      where: { workspaceId },
      select: { id: true, clientName: true },
    });
    for (const m of meetings) {
      const draftReadyAt = daysAgo(3);
      const finalizedAt = daysAgo(2);
      await prisma.meeting.update({
        where: { id: m.id },
        data: {
          status: "FINALIZED",
          clientId: null,
          clientName: "Prior engagement (archived)",
          clientMatchConfidence: null,
          draftReadyAt,
          finalizedAt,
          timeToFinalize: Math.round(
            (finalizedAt.getTime() - draftReadyAt.getTime()) / 1000
          ),
          finalizeReason: "COMPLETE_REVIEW",
          searchableText: "prior engagement archived demo reseed",
        },
      });
    }

    // ── Firm identity (non-customer IAPD firm) ──
    await prisma.workspace.update({
      where: { id: workspaceId },
      data: { name: DEMO_FIRM.workspaceName },
    });

    const existingProfile = await prisma.firmProfile.findUnique({
      where: { workspaceId },
      select: { id: true },
    });
    if (existingProfile) {
      await prisma.firmProfile.update({
        where: { workspaceId },
        data: {
          crdNumber: DEMO_FIRM.crdNumber,
          ccoName: DEMO_FIRM.ccoName,
          aumUsd: DEMO_FIRM.aumUsd,
          deletedAt: null,
          status: "ACTIVE",
          setupCompletedAt: now,
        },
      });
    } else {
      await prisma.firmProfile.create({
        data: {
          workspaceId,
          crdNumber: DEMO_FIRM.crdNumber,
          ccoName: DEMO_FIRM.ccoName,
          aumUsd: DEMO_FIRM.aumUsd,
          status: "ACTIVE",
          setupCompletedAt: now,
        },
      });
    }

    // ── Create clean synthetic clients, meetings, email, flags ──
    const createdClients: Array<{
      id: string;
      name: string;
      email: string;
      feeBody: string;
      lastTopic: string;
    }> = [];

    for (const c of SYNTHETIC_CLIENTS) {
      const client = await prisma.client.create({
        data: {
          workspaceId,
          name: c.name,
          status: "CLIENT",
          lastContactAt: daysAgo(1),
        },
      });
      await prisma.emailAlias.create({
        data: {
          workspaceId,
          clientId: client.id,
          address: c.email,
          verified: true,
        },
      });
      createdClients.push({ id: client.id, ...c });
    }

    for (const [i, c] of createdClients.entries()) {
      const meetingDate = daysAgo(4 + i);
      const draftReadyAt = daysAgo(3 + i);
      const finalizedAt = daysAgo(2 + i, 16);
      const searchableText = [
        c.name,
        "annual review",
        c.lastTopic,
        "fee disclosure discussed",
        "suitability confirmed",
      ]
        .join(" ")
        .toLowerCase();

      const meeting = await prisma.meeting.create({
        data: {
          workspaceId,
          clientId: c.id,
          clientName: c.name,
          clientMatchConfidence: "EMAIL",
          participantEmails: [c.email],
          meetingType: "Annual Review",
          meetingDate,
          status: "FINALIZED",
          draftReadyAt,
          finalizedAt,
          timeToFinalize: Math.round(
            (finalizedAt.getTime() - draftReadyAt.getTime()) / 1000
          ),
          finalizeReason: "COMPLETE_REVIEW",
          searchableText,
          transcript: {
            segments: [
              {
                startTime: 12,
                endTime: 40,
                speaker: "Advisor",
                text: `Today we covered ${c.lastTopic}.`,
              },
              {
                startTime: 41,
                endTime: 70,
                speaker: "Client",
                text: "That sounds good. Please send the fee disclosure follow-up.",
              },
            ],
          },
          extraction: {
            topics: [c.lastTopic, "fee disclosure"],
            recommendations: [],
            disclosures: [{ text: "Advisory fee schedule reviewed", startTime: 41 }],
            decisions: [],
            followUps: [{ text: "Email fee brochure", startTime: 70 }],
          },
        },
      });

      // Recent open flags (age 1–2 days) so avg age stays healthy
      if (i < 3) {
        await prisma.flag.create({
          data: {
            workspaceId,
            meetingId: meeting.id,
            sourceType: "MEETING",
            sourceId: meeting.id,
            type: i === 0 ? "MISSING_DISCLOSURE" : "CONFLICT_LANGUAGE",
            severity: "WARN",
            status: "OPEN",
            createdAt: daysAgo(i === 0 ? 1 : 2),
            evidence: {
              excerpt: "Demo seed flag - recent open item for queue health",
            },
          },
        });
      }

      // Closed flag for resolve-rate
      await prisma.flag.create({
        data: {
          workspaceId,
          meetingId: meeting.id,
          sourceType: "MEETING",
          sourceId: meeting.id,
          type: "MISSING_SUITABILITY_BASIS",
          severity: "INFO",
          status: "CLOSED",
          createdAt: daysAgo(5),
          resolvedAt: daysAgo(4),
          resolutionType: "ADD_CONTEXT",
          resolutionNote: "Suitability memo attached",
        },
      });

      // Fee email (Ask seed query #1)
      const feeSubject = `Fee schedule question - ${c.name}`;
      const feeBody = c.feeBody;
      const feeHash = sha256(`${feeSubject}\n${feeBody}\n${c.email}`);
      const feeOccurredAt = daysAgo(10 + i);
      const thread = await prisma.communicationThread.create({
        data: {
          workspaceId,
          channel: "EMAIL_GMAIL",
          externalThreadId: `demo-fee-${c.id}`,
          subject: feeSubject,
          participants: [{ email: c.email, role: "client" }],
        },
      });
      const evidence = await prisma.evidenceItem.create({
        data: {
          workspaceId,
          clientId: c.id,
          sourceType: "EMAIL",
          title: feeSubject,
          occurredAt: feeOccurredAt,
          contentSha256: feeHash,
          searchableText: emailSearchable(feeSubject, feeBody),
          classificationStatus: "COMPLETE",
        },
      });
      await prisma.communication.create({
        data: {
          threadId: thread.id,
          evidenceItemId: evidence.id,
          direction: "INBOUND",
          sentAt: feeOccurredAt,
          fromAddress: c.email,
          toAddresses: ["compliance@demo.complyvault.co"],
          ccAddresses: [],
          bodyText: feeBody,
          internetMessageId: `<demo-fee-${c.id}@example.com>`,
        },
      });
      await prisma.clientActivity.create({
        data: {
          workspaceId,
          clientId: c.id,
          type: "EMAIL_RECEIVED",
          occurredAt: feeOccurredAt,
          title: feeSubject,
          direction: "INBOUND",
          counterparties: [c.email],
          evidenceItemId: evidence.id,
          threadId: thread.id,
          contentSha256: feeHash,
        },
      });
    }

    // Performance / guaranteed-return email (Ask seed query #2)
    const perfClient = createdClients.find(
      (c) => c.name === PERFORMANCE_EMAIL.clientName
    );
    if (perfClient) {
      const occurredAt = daysAgo(8);
      const hash = sha256(
        `${PERFORMANCE_EMAIL.subject}\n${PERFORMANCE_EMAIL.body}`
      );
      const thread = await prisma.communicationThread.create({
        data: {
          workspaceId,
          channel: "EMAIL_GMAIL",
          externalThreadId: `demo-perf-${perfClient.id}`,
          subject: PERFORMANCE_EMAIL.subject,
          participants: [{ email: perfClient.email, role: "client" }],
        },
      });
      const evidence = await prisma.evidenceItem.create({
        data: {
          workspaceId,
          clientId: perfClient.id,
          sourceType: "EMAIL",
          title: PERFORMANCE_EMAIL.subject,
          occurredAt,
          contentSha256: hash,
          searchableText: emailSearchable(
            PERFORMANCE_EMAIL.subject,
            PERFORMANCE_EMAIL.body
          ),
          classificationStatus: "COMPLETE",
        },
      });
      const communication = await prisma.communication.create({
        data: {
          threadId: thread.id,
          evidenceItemId: evidence.id,
          direction: "OUTBOUND",
          sentAt: occurredAt,
          fromAddress: "compliance@demo.complyvault.co",
          toAddresses: [perfClient.email],
          ccAddresses: [],
          bodyText: PERFORMANCE_EMAIL.body,
          internetMessageId: `<demo-perf-${perfClient.id}@example.com>`,
        },
      });
      await prisma.clientActivity.create({
        data: {
          workspaceId,
          clientId: perfClient.id,
          type: "EMAIL_SENT",
          occurredAt,
          title: PERFORMANCE_EMAIL.subject,
          direction: "OUTBOUND",
          counterparties: [perfClient.email],
          evidenceItemId: evidence.id,
          threadId: thread.id,
          contentSha256: hash,
        },
      });
      await prisma.flag.create({
        data: {
          workspaceId,
          sourceType: "EMAIL",
          sourceId: thread.id,
          communicationId: communication.id,
          type: "PERFORMANCE_CLAIM",
          severity: "WARN",
          status: "CLOSED",
          createdAt: daysAgo(7),
          resolvedAt: daysAgo(6),
          resolutionType: "DISMISSED_WITH_REASON",
          resolutionNote: "Outbound disclaimer - no promise of returns",
          dedupeKey: `email:${communication.id}:PERFORMANCE_CLAIM`,
        },
      });
    }

    const openFlags = await prisma.flag.count({
      where: {
        workspaceId,
        status: { in: ["OPEN", "IN_REMEDIATION", "PENDING_VERIFICATION"] },
      },
    });
    const clients = await prisma.client.count({
      where: { workspaceId, deletedAt: null },
    });
    const evidenceLive = await prisma.evidenceItem.count({
      where: { workspaceId, deletedAt: null },
    });

    console.log("\nDemo seed complete.");
    console.log({
      firm: DEMO_FIRM.workspaceName,
      crd: DEMO_FIRM.crdNumber,
      cco: DEMO_FIRM.ccoName,
      clients,
      evidenceLive,
      openFlags,
    });
    console.log("\nAsk only these live:");
    console.log('  1. "Show me every email where a client mentioned fees since April"');
    console.log('  2. "Has any advisor promised performance in writing?"');
    console.log(
      '  3. "When did we last hear from Margaret Ellison and about what?"'
    );
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
