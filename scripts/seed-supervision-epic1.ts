/**
 * CV-SI-002 / Epic 1 — deterministic supervisory outcome seed.
 *
 * Creates 147 processed meetings with:
 *   139 CLEARED, 5 ROUTINE_SAMPLE, 3 ESCALATED (open flags), 0 HELD.
 *
 * Usage:
 *   npx tsx scripts/seed-supervision-epic1.ts --workspace=<id> --confirm
 */
import { PrismaClient } from "../generated/prisma";
import { PrismaNeon } from "@prisma/adapter-neon";
import { Pool } from "@neondatabase/serverless";

const SI_CLIENT = "SI Epic1 Demo Client";
const SI_ID_PREFIX = "si-e1-mtg-";

function parseArgs(argv: string[]): { workspaceId: string | null; confirm: boolean } {
  let workspaceId: string | null = null;
  let confirm = false;
  for (const arg of argv) {
    if (arg.startsWith("--workspace=")) {
      workspaceId = arg.slice("--workspace=".length).trim() || null;
    }
    if (arg === "--confirm") confirm = true;
  }
  return { workspaceId, confirm };
}

function pad(n: number): string {
  return String(n).padStart(3, "0");
}

async function main(): Promise<void> {
  const { workspaceId, confirm } = parseArgs(process.argv.slice(2));
  if (!workspaceId || !confirm) {
    console.error(
      "Usage: npx tsx scripts/seed-supervision-epic1.ts --workspace=<id> --confirm",
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

    console.log(`Seeding Epic 1 supervision outcomes for ${workspace.name}`);

    // Ensure active firm profile so CLEARED is allowed by processing rules.
    const existingProfile = await prisma.firmProfile.findFirst({
      where: { workspaceId, deletedAt: null },
      select: { id: true, status: true },
    });
    if (!existingProfile) {
      await prisma.firmProfile.create({
        data: {
          workspaceId,
          status: "ACTIVE",
          crdNumber: "000000",
          ccoName: "Synthetic CCO",
          approvedAt: now,
        },
      });
    } else if (existingProfile.status !== "ACTIVE") {
      await prisma.firmProfile.update({
        where: { id: existingProfile.id },
        data: { status: "ACTIVE", approvedAt: now },
      });
    }

    await prisma.supervisorySamplingConfig.upsert({
      where: { workspaceId },
      create: { workspaceId, randomPercentage: 3, manualSelectionEnabled: true },
      update: { manualSelectionEnabled: true, deletedAt: null },
    });

    const meetingIds = Array.from({ length: 147 }, (_, i) => `${SI_ID_PREFIX}${pad(i + 1)}`);
    await prisma.flag.deleteMany({
      where: { workspaceId, meetingId: { in: meetingIds } },
    });

    const specs: Array<{
      outcome: "CLEARED" | "ROUTINE_SAMPLE" | "ESCALATED";
      reason: string;
      withOpenFlag?: boolean;
      control?: string;
    }> = [
      ...Array.from({ length: 139 }, () => ({
        outcome: "CLEARED" as const,
        reason: "No actionable supervisory concern identified",
      })),
      ...Array.from({ length: 5 }, (_, i) => ({
        outcome: "ROUTINE_SAMPLE" as const,
        reason: i === 0 ? "Manual selection" : `Random 3% sample`,
      })),
      {
        outcome: "ESCALATED" as const,
        reason: "Rollover recommendation with unresolved insurance conflict",
        withOpenFlag: true,
        control: "MISSING_DISCLOSURE",
      },
      {
        outcome: "ESCALATED" as const,
        reason: "Unsupported performance-language concern",
        withOpenFlag: true,
        control: "PERFORMANCE_CLAIM",
      },
      {
        outcome: "ESCALATED" as const,
        reason: "Fee-disclosure inconsistency",
        withOpenFlag: true,
        control: "FEE_DISPUTE",
      },
    ];

    for (let i = 0; i < specs.length; i += 1) {
      const spec = specs[i]!;
      const id = meetingIds[i]!;
      const meetingDate = new Date(now.getTime() - (specs.length - i) * 86_400_000);

      await prisma.meeting.upsert({
        where: { id },
        create: {
          id,
          workspaceId,
          clientName: SI_CLIENT,
          meetingType: "Annual Review",
          meetingDate,
          status: "DRAFT_READY",
          draftReadyAt: meetingDate,
          processedAt: meetingDate,
          supervisoryOutcome: spec.outcome,
          outcomeReason: spec.reason,
          outcomeConfidence: spec.outcome === "ESCALATED" ? 0.95 : 0.85,
          primaryControlId: spec.control ?? null,
          heldReason: null,
          parkedReason: null,
          transcript: { segments: [], duration: 0 },
          extraction: {
            topics: ["fees"],
            recommendations: [],
            disclosures: [],
            decisions: [],
            followUps: [],
            evidenceMap: {},
          },
        },
        update: {
          clientName: SI_CLIENT,
          meetingDate,
          status: "DRAFT_READY",
          draftReadyAt: meetingDate,
          processedAt: meetingDate,
          supervisoryOutcome: spec.outcome,
          outcomeReason: spec.reason,
          outcomeConfidence: spec.outcome === "ESCALATED" ? 0.95 : 0.85,
          primaryControlId: spec.control ?? null,
          heldReason: null,
          parkedReason: null,
        },
      });

      if (spec.withOpenFlag && spec.control) {
        await prisma.flag.create({
          data: {
            workspaceId,
            meetingId: id,
            sourceType: "MEETING",
            sourceId: id,
            type: spec.control as never,
            severity: "CRITICAL",
            status: "OPEN",
            createdByType: "SYSTEM",
            cmDisposition: "ESCALATED",
            escalationReason: spec.reason,
            evidence: { rationale: spec.reason, seeded: true },
          },
        });
      }
    }

    const summaryMeetings = await prisma.meeting.groupBy({
      by: ["supervisoryOutcome"],
      where: {
        workspaceId,
        id: { startsWith: SI_ID_PREFIX },
        processedAt: { not: null },
      },
      _count: { id: true },
    });

    console.log("Seeded supervisory outcomes:");
    for (const row of summaryMeetings) {
      console.log(`  ${row.supervisoryOutcome}: ${row._count.id}`);
    }
    console.log("Expected: CLEARED 139, ROUTINE_SAMPLE 5, ESCALATED 3, HELD 0 (total 147)");
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
