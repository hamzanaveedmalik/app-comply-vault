/**
 * Demo-scope one-shot embedding backfill.
 *
 * This script is intentionally not resumable and must only run against the
 * prepared demonstration workspace. It embeds all current email evidence and
 * meetings for the supplied workspace once.
 *
 * Usage: DATABASE_URL=... npx tsx scripts/demo-embed-backfill.ts <workspaceId>
 */

import { config } from "dotenv";
import ws from "ws";
import { neonConfig, Pool } from "@neondatabase/serverless";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "../generated/prisma/index.js";

config();
neonConfig.webSocketConstructor = ws;
neonConfig.pipelineConnect = false;

async function main(): Promise<void> {
  const workspaceId = process.argv[2];
  if (!workspaceId) {
    throw new Error("Usage: npx tsx scripts/demo-embed-backfill.ts <workspaceId>");
  }
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required");
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter: new PrismaNeon(pool) });
  try {
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { id: true, name: true },
    });
    if (!workspace) throw new Error("Workspace not found");

    const [{ embedEmailEvidence, embedMeetingEvidence }, emails, meetings] = await Promise.all([
      import("../src/server/ask/embeddings.js"),
      prisma.evidenceItem.findMany({
        where: { workspaceId, sourceType: "EMAIL", deletedAt: null },
        select: { id: true },
      }),
      prisma.meeting.findMany({
        where: { workspaceId },
        select: { id: true },
      }),
    ]);

    console.log(`Demo-only one-shot backfill for ${workspace.name} (${workspace.id})`);
    let emailEmbedded = 0;
    let meetingEmbedded = 0;
    for (const email of emails) {
      const result = await embedEmailEvidence({ workspaceId, evidenceItemId: email.id });
      if (result.status === "embedded") emailEmbedded += 1;
    }
    for (const meeting of meetings) {
      const result = await embedMeetingEvidence({ workspaceId, meetingId: meeting.id });
      if (result.status === "embedded") meetingEmbedded += 1;
    }
    console.log(`Embedded ${emailEmbedded} email records and ${meetingEmbedded} meetings.`);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Demo backfill failed");
  process.exitCode = 1;
});
