/**
 * RIACT verification via Neon HTTP (works behind corp TLS MitM).
 */
import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";
import { evaluateHonestMiss } from "../src/server/ask/coverage.js";
import {
  buildCoverageStatement,
  interpretRequestItem,
} from "../src/server/candidate-pack/types.js";
import {
  RIACT_CITATION_QUESTION,
  RIACT_COVERAGE_GAP,
  RIACT_CORPUS_FROM_ISO,
  RIACT_CORPUS_TO_ISO,
  RIACT_SEC_DOCUMENT_REQUEST,
  RIACT_SMS_REFUSAL_QUESTION,
  RIACT_SMS_SOURCE,
} from "../src/server/demo/riact/tenant.js";

config();
process.env.NODE_TLS_REJECT_UNAUTHORIZED ??= "0";

const WORKSPACE = "riact-ws-cactus";

async function main() {
  const sql = neon(process.env.DATABASE_URL);
  const manifestRow = await sql`
    SELECT sources, "gapPeriods", "unindexedSources", "lastIndexedAt"
    FROM "IndexCoverageManifest"
    WHERE "workspaceId" = ${WORKSPACE} AND "deletedAt" IS NULL
    LIMIT 1
  `;
  const row = manifestRow[0];
  const manifest = {
    workspaceId: WORKSPACE,
    sources: row?.sources ?? [],
    gapPeriods: row?.gapPeriods ?? [],
    unindexedSources: row?.unindexedSources ?? [],
    lastIndexedAt: row?.lastIndexedAt
      ? new Date(row.lastIndexedAt).toISOString()
      : null,
  };

  console.log("=== Idempotency hash sample (first 3 emails) ===");
  const hashes = await sql`
    SELECT id, "contentSha256" FROM "EvidenceItem"
    WHERE "workspaceId" = ${WORKSPACE} AND "sourceType" = 'EMAIL'
    ORDER BY id LIMIT 3
  `;
  console.log(hashes);

  console.log("\n=== Demo moment B (SMS honest miss contract) ===");
  const smsMiss = evaluateHonestMiss({
    question: RIACT_SMS_REFUSAL_QUESTION,
    manifest,
    matchCount: 5,
    belowThreshold: false,
  });
  console.log(smsMiss?.message ?? "MISSING");

  console.log("\n=== Demo moment A (Candidate Pack coverage contract) ===");
  const scope = interpretRequestItem(RIACT_SEC_DOCUMENT_REQUEST.requestItemText);
  const emailCount = await sql`
    SELECT count(*)::int AS c FROM "EvidenceItem"
    WHERE "workspaceId" = ${WORKSPACE} AND "sourceType" = 'EMAIL' AND "deletedAt" IS NULL
      AND "searchableText" ILIKE '%Marcus Holloway%'
  `;
  const meetingCount = await sql`
    SELECT count(*)::int AS c FROM "Meeting"
    WHERE "workspaceId" = ${WORKSPACE}
      AND ("clientName" ILIKE '%Marcus Holloway%' OR "searchableText" ILIKE '%Marcus Holloway%')
  `;
  const coverage = buildCoverageStatement({
    scope,
    meetingCount: meetingCount[0].c,
    emailCount: emailCount[0].c,
    gapPeriods: [
      {
        from: RIACT_COVERAGE_GAP.from,
        to: RIACT_COVERAGE_GAP.to,
        reason: RIACT_COVERAGE_GAP.reason,
      },
    ],
    unindexedSources: [RIACT_SMS_SOURCE.name],
    searchPopulation: {
      emailsScanned: emailCount[0].c,
      meetingsScanned: meetingCount[0].c,
      emailsMatched: emailCount[0].c,
      meetingsMatched: meetingCount[0].c,
      sourcesConnected: scope.channels,
    },
  });
  console.log(
    JSON.stringify(
      {
        emailMatches: emailCount[0].c,
        meetingMatches: meetingCount[0].c,
        corpusFrom: RIACT_CORPUS_FROM_ISO,
        corpusTo: RIACT_CORPUS_TO_ISO,
        coverageStatement: coverage,
      },
      null,
      2,
    ),
  );

  console.log("\n=== Citation question corpus check ===");
  const feeEmails = await sql`
    SELECT id, "contentSha256", title FROM "EvidenceItem"
    WHERE "workspaceId" = ${WORKSPACE} AND "deletedAt" IS NULL
      AND "searchableText" ILIKE '%marcus holloway%'
      AND "searchableText" ILIKE '%fee%'
    ORDER BY "occurredAt" DESC
    LIMIT 5
  `;
  console.log({ question: RIACT_CITATION_QUESTION, feeEmailEvidence: feeEmails });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
