/**
 * RIACT demo verification — Ask + Candidate Pack smoke (local only).
 * Usage: npx tsx scripts/verify-riact-demo.ts
 */
import { config } from "dotenv";
import ws from "ws";
import { neonConfig, Pool } from "@neondatabase/serverless";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "../generated/prisma/index.js";

config();
process.env.NODE_TLS_REJECT_UNAUTHORIZED ??= "0";
process.env.EMAIL_INTELLIGENCE_ENABLED ??= "true";
process.env.ASK_HYBRID_RETRIEVAL ??= "true";
process.env.RELEASE1_DEMO_ENABLED ??= "true";

neonConfig.webSocketConstructor = ws;
neonConfig.pipelineConnect = false;

const UNSCRIPTED = [
  "What did we discuss with Marcus Holloway about fees?",
  "Has Marcus Holloway ever raised a complaint?",
  "Which of our clients have not had an annual review in the last twelve months?",
  "Show me every communication mentioning a rollover.",
  "Were any of these meetings missing required disclosures?",
  "What is our biggest compliance risk right now?",
  "Did any adviser discuss performance guarantees with a client?",
  "What happened in the meeting on 2025-03-15?",
] as const;

function formatAskOutcome(out: {
  kind: string;
  answer?: string;
  message?: string;
  citations?: Array<{ contentSha256?: string }>;
}): string {
  if (out.kind === "answer") {
    const hashes =
      out.citations
        ?.map((c) => c.contentSha256)
        .filter(Boolean)
        .join(", ") ?? "";
    return `${out.answer ?? ""}${hashes ? `\n[citations: ${hashes}]` : ""}`;
  }
  if ("message" in out && out.message) return out.message;
  return JSON.stringify(out);
}

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL required");
  }

  const {
    RIACT_CITATION_QUESTION,
    RIACT_DEMO_USER,
    RIACT_SEC_DOCUMENT_REQUEST,
    RIACT_SMS_REFUSAL_QUESTION,
    riactPrimaryWorkspaceId,
  } = await import("../src/server/demo/riact/tenant.js");
  const { askComplyVault } = await import("../src/server/ask/index.js");
  const { loadCoverageManifest } = await import("../src/server/ask/load-coverage.js");
  const {
    confirmCandidatePackScope,
    createCandidatePackDraft,
    generateCandidatePack,
  } = await import("../src/server/candidate-pack/service.js");
  const { interpretRequestItem } = await import("../src/server/candidate-pack/types.js");

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter: new PrismaNeon(pool) });
  const globalForPrisma = globalThis as { prisma?: PrismaClient };
  globalForPrisma.prisma = prisma;

  const workspaceId = riactPrimaryWorkspaceId();
  const userId = RIACT_DEMO_USER.id;
  const coverageManifest = await loadCoverageManifest(workspaceId);
  const askDeps = { prisma: prisma as never, coverageManifest };

  try {
    console.log("=== Demo moment B (SMS refusal) ===");
    const sms = await askComplyVault(
      { workspaceId, userId, question: RIACT_SMS_REFUSAL_QUESTION },
      askDeps,
    );
    console.log(formatAskOutcome(sms));

    console.log("\n=== Demo moment C (citation question) ===");
    const cited = await askComplyVault(
      { workspaceId, userId, question: RIACT_CITATION_QUESTION },
      askDeps,
    );
    console.log(formatAskOutcome(cited));

    console.log("\n=== Demo moment A (Candidate Pack) ===");
    const draft = await createCandidatePackDraft({
      workspaceId,
      userId,
      requestText: RIACT_SEC_DOCUMENT_REQUEST.requestItemText,
    });
    const scope = interpretRequestItem(RIACT_SEC_DOCUMENT_REQUEST.requestItemText);
    await confirmCandidatePackScope({
      workspaceId,
      packId: draft.id,
      userId,
      scope,
    });
    const pack = await generateCandidatePack({
      workspaceId,
      packId: draft.id,
      userId,
    });
    console.log(
      JSON.stringify(
        {
          status: pack.status,
          emailMatches: pack.emailEvidenceIds.length,
          meetingMatches: pack.meetingIds.length,
          coverageStatement: pack.coverageStatement,
        },
        null,
        2,
      ),
    );

    console.log("\n=== Unscripted questions ===");
    for (const question of UNSCRIPTED) {
      const out = await askComplyVault({ workspaceId, userId, question }, askDeps);
      console.log(`Q: ${question}`);
      console.log(`A: ${formatAskOutcome(out)}`);
      console.log("---");
    }
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
