/**
 * CV-SI-029 — Deterministic AdvizorStack synthetic production tenant.
 *
 * Uses Neon HTTP (not Prisma TCP/WS) so seeding works behind corporate TLS MitM.
 *
 * Usage:
 *   npx tsx scripts/seed-supervision-advizorstack.ts --confirm
 *   npx tsx scripts/seed-supervision-advizorstack.ts --confirm --userEmail=you@example.com
 *   Repeat --userEmail= to link multiple presenter accounts.
 */
import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";
import {
  ADVIZORSTACK_ADVISERS,
  ADVIZORSTACK_EXPECTED_COUNTS,
  ADVIZORSTACK_FIRMS,
  ADVIZORSTACK_ONBOARDING_TYPE,
  ADVIZORSTACK_PRIMARY_FINDING,
  ADVIZORSTACK_ROLLOVER_FLAGS,
  expectedMeetingIdsForFirm,
  padMeetingIndex,
  type AdvizorStackFirmDef,
} from "../src/server/supervision/advizorstack-tenant";

config();

type Sql = ReturnType<typeof neon>;

function parseArgs(argv: string[]): {
  confirm: boolean;
  userEmails: string[];
} {
  let confirm = false;
  const userEmails: string[] = [];
  for (const arg of argv) {
    if (arg === "--confirm") confirm = true;
    if (arg.startsWith("--userEmail=")) {
      const email = arg.slice("--userEmail=".length).trim();
      if (email) userEmails.push(email);
    }
  }
  return { confirm, userEmails };
}

function daysAgo(now: Date, days: number): Date {
  return new Date(now.getTime() - days * 86_400_000);
}

async function upsertFirmWorkspace(
  sql: Sql,
  firm: AdvizorStackFirmDef,
  now: Date,
): Promise<void> {
  await sql`
    INSERT INTO "Workspace" (id, name, "onboardingType", "billingStatus", "planTier", "createdAt", "updatedAt")
    VALUES (
      ${firm.workspaceId},
      ${firm.name},
      ${ADVIZORSTACK_ONBOARDING_TYPE},
      'PILOT',
      'TEAM',
      ${now},
      ${now}
    )
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      "onboardingType" = EXCLUDED."onboardingType",
      "updatedAt" = EXCLUDED."updatedAt"
  `;

  await sql`
    INSERT INTO "FirmProfile" (
      id, "workspaceId", status, "crdNumber", "ccoName", "approvedAt", "createdAt", "updatedAt"
    ) VALUES (
      ${firm.firmProfileId},
      ${firm.workspaceId},
      'ACTIVE',
      ${firm.crdNumber},
      ${firm.ccoName},
      ${now},
      ${now},
      ${now}
    )
    ON CONFLICT ("workspaceId") DO UPDATE SET
      status = 'ACTIVE',
      "crdNumber" = EXCLUDED."crdNumber",
      "ccoName" = EXCLUDED."ccoName",
      "approvedAt" = EXCLUDED."approvedAt",
      "deletedAt" = NULL,
      "updatedAt" = EXCLUDED."updatedAt"
  `;

  const sampleId = `si-as-sample-${firm.workspaceId}`;
  await sql`
    INSERT INTO "SupervisorySamplingConfig" (
      id, "workspaceId", "randomPercentage", "manualSelectionEnabled", "createdAt", "updatedAt"
    ) VALUES (
      ${sampleId},
      ${firm.workspaceId},
      3,
      true,
      ${now},
      ${now}
    )
    ON CONFLICT ("workspaceId") DO UPDATE SET
      "manualSelectionEnabled" = true,
      "deletedAt" = NULL,
      "updatedAt" = EXCLUDED."updatedAt"
  `;
}

async function clearFirmSeedArtifacts(
  sql: Sql,
  firm: AdvizorStackFirmDef,
): Promise<void> {
  const meetingIds = expectedMeetingIdsForFirm(firm);
  const flagIds = [
    ...new Set([
      firm.priority.flagId,
      ...ADVIZORSTACK_ROLLOVER_FLAGS.filter((f) => f.workspaceId === firm.workspaceId).map(
        (f) => f.id,
      ),
    ]),
  ];
  const resolutionIds = ADVIZORSTACK_ROLLOVER_FLAGS.filter(
    (f) => f.workspaceId === firm.workspaceId && f.resolutionId,
  ).map((f) => f.resolutionId as string);
  const taskIds = ADVIZORSTACK_ROLLOVER_FLAGS.filter(
    (f) => f.workspaceId === firm.workspaceId && f.taskId,
  ).map((f) => f.taskId as string);

  if (taskIds.length > 0) {
    await sql`DELETE FROM "ActionItem" WHERE id = ANY(${taskIds})`;
  }
  if (resolutionIds.length > 0) {
    await sql`DELETE FROM "ResolutionRecord" WHERE id = ANY(${resolutionIds})`;
  }
  await sql`DELETE FROM "Flag" WHERE id = ANY(${flagIds}) OR ("workspaceId" = ${firm.workspaceId} AND "meetingId" = ANY(${meetingIds}))`;
  await sql`DELETE FROM "Meeting" WHERE "workspaceId" = ${firm.workspaceId} AND id = ANY(${meetingIds})`;
}

async function seedFirmMeetings(
  sql: Sql,
  firm: AdvizorStackFirmDef,
  now: Date,
  adviserA: string,
  adviserB: string,
): Promise<void> {
  const specs: Array<{
    id: string;
    outcome: "CLEARED" | "ROUTINE_SAMPLE" | "ESCALATED";
    reason: string;
    control: string | null;
    adviserId: string | null;
    dayOffset: number;
  }> = [];

  for (let i = 1; i <= firm.cleared; i += 1) {
    specs.push({
      id: `${firm.meetingPrefix}${padMeetingIndex(i)}`,
      outcome: "CLEARED",
      reason: "No actionable supervisory concern identified",
      control: null,
      dayOffset: 28 - (i % 27),
      adviserId: i % 2 === 0 ? adviserA : adviserB,
    });
  }
  for (let i = 1; i <= firm.sampled; i += 1) {
    const index = firm.cleared + i;
    specs.push({
      id: `${firm.meetingPrefix}${padMeetingIndex(index)}`,
      outcome: "ROUTINE_SAMPLE",
      reason: i === 1 ? "Manual selection" : "Random 3% sample",
      control: null,
      dayOffset: 18 - i,
      adviserId: adviserA,
    });
  }
  specs.push({
    id: firm.priority.meetingId,
    outcome: "ESCALATED",
    reason: firm.priority.reason,
    control: firm.priority.control,
    dayOffset: 12,
    adviserId: firm.priority.control === "MISSING_DISCLOSURE" ? adviserA : adviserB,
  });

  for (const spec of specs) {
    const meetingDate = daysAgo(now, Math.max(1, spec.dayOffset));
    const transcript = JSON.stringify({ segments: [], duration: 0, synthetic: true });
    const extraction = JSON.stringify({
      topics: ["fees"],
      recommendations: [],
      disclosures: [],
      decisions: [],
      followUps: [],
      evidenceMap: {},
      synthetic: true,
    });
    await sql`
      INSERT INTO "Meeting" (
        id, "workspaceId", "clientName", "meetingType", "meetingDate", status,
        "draftReadyAt", "processedAt", "supervisoryOutcome", "outcomeReason",
        "outcomeConfidence", "primaryControlId", "advisorCertifiedByUserId", "advisorCertifiedAt",
        transcript, extraction, "createdAt", "updatedAt"
      ) VALUES (
        ${spec.id},
        ${firm.workspaceId},
        ${firm.clientName},
        ${"Annual Review"},
        ${meetingDate},
        ${"DRAFT_READY"},
        ${meetingDate},
        ${meetingDate},
        ${spec.outcome}::"SupervisoryOutcome",
        ${spec.reason},
        ${spec.outcome === "ESCALATED" ? 0.95 : 0.85},
        ${spec.control},
        ${spec.adviserId},
        ${spec.adviserId ? meetingDate : null},
        ${transcript}::jsonb,
        ${extraction}::jsonb,
        ${now},
        ${now}
      )
    `;
  }

  if (firm.priority.control !== "MISSING_DISCLOSURE") {
    const evidence = JSON.stringify({
      rationale: firm.priority.reason,
      synthetic: true,
      label: "SYNTHETIC",
    });
    await sql`
      INSERT INTO "Flag" (
        id, "workspaceId", "meetingId", "sourceType", "sourceId", type, severity, status,
        "createdByType", "cmDisposition", "escalationReason", evidence,
        "escalatedAt", materiality, "policyMappingCode", "reviewDueAt",
        "createdAt", "updatedAt"
      ) VALUES (
        ${firm.priority.flagId},
        ${firm.workspaceId},
        ${firm.priority.meetingId},
        ${"MEETING"},
        ${firm.priority.meetingId},
        ${firm.priority.control}::"FlagType",
        ${"CRITICAL"},
        ${"OPEN"},
        ${"SYSTEM"},
        ${"ESCALATED"},
        ${firm.priority.reason},
        ${evidence}::jsonb,
        ${now},
        ${"HIGH"}::"FindingMateriality",
        ${firm.priority.control === "PERFORMANCE_CLAIM" ? "PERF-LANG-v1" : "FEE-DISC-v1"},
        ${daysAgo(now, -7)},
        ${now},
        ${now}
      )
    `;
  }
}

async function seedRolloverFindings(sql: Sql, now: Date): Promise<void> {
  for (const row of ADVIZORSTACK_ROLLOVER_FLAGS) {
    const evidence = JSON.stringify({
      controlArea: "rollover-documentation",
      synthetic: true,
      label: "SYNTHETIC",
      primaryDemo: row.id === ADVIZORSTACK_PRIMARY_FINDING.flagId,
    });
    const resolvedAt = row.status === "CLOSED" ? daysAgo(now, 5) : null;
    await sql`
      INSERT INTO "Flag" (
        id, "workspaceId", "meetingId", "sourceType", "sourceId", type, severity, status,
        "createdByType", "cmDisposition", "escalationReason", evidence,
        "resolvedAt", "resolutionType", "resolutionNote",
        "escalatedAt", materiality, "policyMappingCode", "reviewDueAt",
        "createdAt", "updatedAt"
      ) VALUES (
        ${row.id},
        ${row.workspaceId},
        ${row.meetingId},
        ${"MEETING"},
        ${row.meetingId},
        ${"MISSING_DISCLOSURE"}::"FlagType",
        ${"CRITICAL"},
        ${row.status}::"FlagStatus",
        ${"SYSTEM"},
        ${row.status === "CLOSED" ? "RESOLVED" : "ESCALATED"}::"CmFlagDisposition",
        ${"Rollover recommendation with unresolved documentation gap"},
        ${evidence}::jsonb,
        ${resolvedAt},
        ${row.status === "CLOSED" ? "DISMISSED_WITH_REASON" : null}::"FlagResolutionType",
        ${row.status === "CLOSED" ? "Rollover documentation closed after CCO review" : null},
        ${now},
        ${"HIGH"}::"FindingMateriality",
        ${"ROLLOVER-DOC-v1"},
        ${row.status === "CLOSED" ? null : daysAgo(now, -14)},
        ${now},
        ${now}
      )
    `;

    if (row.withTask && row.resolutionId && row.taskId) {
      const metadata = JSON.stringify({ synthetic: true, label: "SYNTHETIC" });
      await sql`
        INSERT INTO "ResolutionRecord" (
          id, "workspaceId", "meetingId", "flagId", "resolutionType", rationale,
          "createdByUserId", metadata, "createdAt", "updatedAt"
        ) VALUES (
          ${row.resolutionId},
          ${row.workspaceId},
          ${row.meetingId},
          ${row.id},
          ${"FOLLOW_UP_REQUIRED"}::"FlagResolutionType",
          ${"Follow-up required: complete rollover documentation before the recommendation is treated as closed"},
          ${row.adviserId},
          ${metadata}::jsonb,
          ${now},
          ${now}
        )
      `;
      const taskStatus =
        row.id === ADVIZORSTACK_PRIMARY_FINDING.flagId ? "IN_PROGRESS" : "OPEN";
      await sql`
        INSERT INTO "ActionItem" (
          id, "resolutionId", title, status, "ownerId", "dueDate", required, "createdAt", "updatedAt"
        ) VALUES (
          ${row.taskId},
          ${row.resolutionId},
          ${"Complete rollover documentation remediation"},
          ${taskStatus}::"RemediationTaskStatus",
          ${row.adviserId},
          ${daysAgo(now, -14)},
          true,
          ${now},
          ${now}
        )
      `;
    }
  }
}

async function main(): Promise<void> {
  const { confirm, userEmails } = parseArgs(process.argv.slice(2));
  if (!confirm) {
    console.error(
      "Usage: npx tsx scripts/seed-supervision-advizorstack.ts --confirm [--userEmail=...]",
    );
    process.exit(1);
  }
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }

  const sql = neon(process.env.DATABASE_URL);
  const now = new Date();

  console.log("Seeding AdvizorStack synthetic tenant (CV-SI-029)…");

  for (const adviser of ADVIZORSTACK_ADVISERS) {
    await sql`
      INSERT INTO "User" (id, email, name, "emailVerified")
      VALUES (${adviser.id}, ${adviser.email}, ${adviser.name}, ${now})
      ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        name = EXCLUDED.name
    `;
    console.log(`  adviser ${adviser.id}`);
  }

  for (const firm of ADVIZORSTACK_FIRMS) {
    console.log(`  firm ${firm.workspaceId}`);
    await upsertFirmWorkspace(sql, firm, now);
    await clearFirmSeedArtifacts(sql, firm);
    await seedFirmMeetings(
      sql,
      firm,
      now,
      ADVIZORSTACK_ADVISERS[0].id,
      ADVIZORSTACK_ADVISERS[1].id,
    );
    for (const adviser of ADVIZORSTACK_ADVISERS) {
      await sql`
        INSERT INTO "UserWorkspace" ("userId", "workspaceId", role)
        VALUES (${adviser.id}, ${firm.workspaceId}, ${"ADVISOR"}::"WorkspaceRole")
        ON CONFLICT ("userId", "workspaceId") DO UPDATE SET
          role = EXCLUDED.role,
          "removedAt" = NULL,
          "removedById" = NULL
      `;
    }
  }

  await seedRolloverFindings(sql, now);

  for (const userEmail of userEmails) {
    const users = await sql`SELECT id FROM "User" WHERE email = ${userEmail} LIMIT 1`;
    const user = users[0] as { id: string } | undefined;
    if (!user) {
      console.warn(`Presenter user not found for email; skipped memberships`);
      continue;
    }
    for (const firm of ADVIZORSTACK_FIRMS) {
      await sql`
        INSERT INTO "UserWorkspace" ("userId", "workspaceId", role)
        VALUES (${user.id}, ${firm.workspaceId}, ${"OWNER_CCO"}::"WorkspaceRole")
        ON CONFLICT ("userId", "workspaceId") DO UPDATE SET
          role = EXCLUDED.role,
          "removedAt" = NULL,
          "removedById" = NULL
      `;
    }
    console.log(`Linked presenter as OWNER_CCO on all three firms`);
  }

  const firmIds = ADVIZORSTACK_FIRMS.map((f) => f.workspaceId);
  const outcomeGroups = await sql`
    SELECT "supervisoryOutcome"::text AS outcome, count(*)::int AS c
    FROM "Meeting"
    WHERE "workspaceId" = ANY(${firmIds}) AND "processedAt" IS NOT NULL
    GROUP BY 1
    ORDER BY 1
  `;
  const openTasks = await sql`
    SELECT count(*)::int AS c FROM "ActionItem"
    WHERE id = ANY(${ADVIZORSTACK_ROLLOVER_FLAGS.filter((f) => f.taskId).map((f) => f.taskId as string)})
      AND status IN ('OPEN', 'IN_PROGRESS')
  `;
  const rolloverFlags = await sql`
    SELECT count(*)::int AS c FROM "Flag"
    WHERE id = ANY(${ADVIZORSTACK_ROLLOVER_FLAGS.map((f) => f.id)})
      AND type = 'MISSING_DISCLOSURE'
  `;

  console.log("Outcome groups:", outcomeGroups);
  console.log(
    `Open remediation tasks: ${(openTasks[0] as { c: number }).c} (expected ${ADVIZORSTACK_EXPECTED_COUNTS.openRemediation})`,
  );
  console.log(
    `Rollover findings: ${(rolloverFlags[0] as { c: number }).c} (expected ${ADVIZORSTACK_EXPECTED_COUNTS.rolloverFindings})`,
  );
  console.log(`Primary finding: ${ADVIZORSTACK_PRIMARY_FINDING.flagId}`);
  console.log("Expected portfolio:", ADVIZORSTACK_EXPECTED_COUNTS);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
