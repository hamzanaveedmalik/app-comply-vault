/**
 * RIACT partner-demo tenant seed — deterministic, idempotent, fully isolated.
 *
 * Usage:
 *   npx tsx scripts/seed-riact.ts --confirm
 *   npx tsx scripts/seed-riact.ts --confirm --embed
 *
 * Then open /demo/riact and sign in with the demo credentials printed at the end.
 */
import { createHash } from "node:crypto";
import { config } from "dotenv";
import bcrypt from "bcryptjs";
import { neon } from "@neondatabase/serverless";
import {
  RIACT_ADVISORS,
  RIACT_CLIENT_FIRMS,
  RIACT_COVERAGE_GAP,
  RIACT_CORPUS_FROM_ISO,
  RIACT_CORPUS_TO_ISO,
  RIACT_DEMO_USER,
  RIACT_MAILBOX,
  RIACT_ONBOARDING_TYPE,
  RIACT_PARENT_PRACTICE,
  RIACT_REFERENCE_DATE_ISO,
  RIACT_SEC_DOCUMENT_REQUEST,
  RIACT_SMS_REFUSAL_QUESTION,
  RIACT_CITATION_QUESTION,
  RIACT_SMS_SOURCE,
  riactPrimaryWorkspaceId,
} from "../src/server/demo/riact/tenant";
import {
  RIACT_CACTUS_CLIENTS,
  RIACT_EMAIL_MESSAGES,
  RIACT_MEETINGS,
  RIACT_THIN_CLIENTS,
  daysBeforeReference,
} from "../src/server/demo/riact/fixtures";
import {
  buildRfc822Mime,
  emailSearchable,
  mailboxStorageKey,
} from "../src/server/demo/riact/mime";

// Match Next.js: .env.local overrides .env so seed targets the same DB as `next dev`.
config();
config({ path: ".env.local", override: true });

process.env.NODE_TLS_REJECT_UNAUTHORIZED ??= "0";

type Sql = ReturnType<typeof neon>;

function parseArgs(argv: string[]): { confirm: boolean; embed: boolean } {
  return {
    confirm: argv.includes("--confirm"),
    embed: argv.includes("--embed"),
  };
}

function refDate(): Date {
  return new Date(RIACT_REFERENCE_DATE_ISO);
}

async function upsertDemoUser(sql: Sql, now: Date): Promise<void> {
  const passwordHash = await bcrypt.hash(RIACT_DEMO_USER.password, 10);
  await sql`
    INSERT INTO "User" (id, email, name, "emailVerified")
    VALUES (
      ${RIACT_DEMO_USER.id},
      ${RIACT_DEMO_USER.email},
      ${RIACT_DEMO_USER.name},
      ${now}
    )
    ON CONFLICT (id) DO UPDATE SET
      email = EXCLUDED.email,
      name = EXCLUDED.name,
      "emailVerified" = EXCLUDED."emailVerified"
  `;
  await sql`
    INSERT INTO "Account" (
      id, "userId", type, provider, "providerAccountId", "access_token", "token_type"
    ) VALUES (
      ${"riact-acct-cco-001"},
      ${RIACT_DEMO_USER.id},
      ${"credentials"},
      ${"credentials"},
      ${RIACT_DEMO_USER.email},
      ${passwordHash},
      ${"bcrypt"}
    )
    ON CONFLICT (provider, "providerAccountId") DO UPDATE SET
      "access_token" = EXCLUDED."access_token"
  `;
}

async function upsertWorkspace(
  sql: Sql,
  args: {
    id: string;
    name: string;
    now: Date;
  },
): Promise<void> {
  await sql`
    INSERT INTO "Workspace" (
      id, name, "onboardingType", "billingStatus", "planTier",
      "mediaPosture", "postureSetById", "postureSetAt",
      "createdAt", "updatedAt"
    ) VALUES (
      ${args.id},
      ${args.name},
      ${RIACT_ONBOARDING_TYPE},
      'PILOT',
      'TEAM',
      ${"RETAIN"}::"MediaPosture",
      ${RIACT_DEMO_USER.id},
      ${args.now},
      ${args.now},
      ${args.now}
    )
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      "onboardingType" = EXCLUDED."onboardingType",
      "mediaPosture" = COALESCE("Workspace"."mediaPosture", EXCLUDED."mediaPosture"),
      "postureSetById" = COALESCE("Workspace"."postureSetById", EXCLUDED."postureSetById"),
      "postureSetAt" = COALESCE("Workspace"."postureSetAt", EXCLUDED."postureSetAt"),
      "updatedAt" = EXCLUDED."updatedAt"
  `;
}

async function upsertFirmProfile(
  sql: Sql,
  args: {
    id: string;
    workspaceId: string;
    crdNumber: string;
    ccoName: string;
    aumUsd: number;
    now: Date;
  },
): Promise<void> {
  await sql`
    INSERT INTO "FirmProfile" (
      id, "workspaceId", status, "crdNumber", "ccoName", "aumUsd",
      "approvedAt", "setupCompletedAt", "createdAt", "updatedAt"
    ) VALUES (
      ${args.id},
      ${args.workspaceId},
      'ACTIVE',
      ${args.crdNumber},
      ${args.ccoName},
      ${args.aumUsd},
      ${args.now},
      ${args.now},
      ${args.now},
      ${args.now}
    )
    ON CONFLICT ("workspaceId") DO UPDATE SET
      status = 'ACTIVE',
      "crdNumber" = EXCLUDED."crdNumber",
      "ccoName" = EXCLUDED."ccoName",
      "aumUsd" = EXCLUDED."aumUsd",
      "deletedAt" = NULL,
      "updatedAt" = EXCLUDED."updatedAt"
  `;
}

async function linkOwnerCco(
  sql: Sql,
  workspaceId: string,
): Promise<void> {
  await sql`
    INSERT INTO "UserWorkspace" ("userId", "workspaceId", role)
    VALUES (${RIACT_DEMO_USER.id}, ${workspaceId}, ${"OWNER_CCO"}::"WorkspaceRole")
    ON CONFLICT ("userId", "workspaceId") DO UPDATE SET
      role = EXCLUDED.role,
      "removedAt" = NULL,
      "removedById" = NULL
  `;
}

async function seedAdvisors(
  sql: Sql,
  workspaceId: string,
  now: Date,
): Promise<void> {
  for (const advisor of RIACT_ADVISORS) {
    await sql`
      INSERT INTO "User" (id, email, name, "emailVerified", image)
      VALUES (
        ${advisor.id},
        ${advisor.email},
        ${advisor.name},
        ${now},
        ${`https://i.pravatar.cc/80?u=${encodeURIComponent(advisor.id)}`}
      )
      ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        name = EXCLUDED.name,
        image = EXCLUDED.image
    `;
    await sql`
      INSERT INTO "UserWorkspace" ("userId", "workspaceId", role)
      VALUES (${advisor.id}, ${workspaceId}, ${"ADVISOR"}::"WorkspaceRole")
      ON CONFLICT ("userId", "workspaceId") DO UPDATE SET
        role = EXCLUDED.role,
        "removedAt" = NULL,
        "removedById" = NULL
    `;
  }
}

async function clearCactusArtifacts(sql: Sql, workspaceId: string): Promise<void> {
  const emailIds = RIACT_EMAIL_MESSAGES.map((m) => m.id);
  const meetingIds = RIACT_MEETINGS.map((m) => m.id);
  const flagIds = RIACT_MEETINGS.filter((m) => m.flag).map((m) => m.flag!.id);
  flagIds.push(
    ...RIACT_EMAIL_MESSAGES.filter((m) => m.flag).map((m) => `riact-email-flag-${m.id}`),
  );

  await sql`DELETE FROM "EvidenceClassification" WHERE "evidenceItemId" = ANY(${emailIds})`;
  await sql`DELETE FROM "ActionItem" WHERE id LIKE 'riact-task-%'`;
  await sql`DELETE FROM "ResolutionRecord" WHERE id LIKE 'riact-res-%' OR ("workspaceId" = ${workspaceId} AND "flagId" = ANY(${flagIds}))`;
  await sql`DELETE FROM "Flag" WHERE id = ANY(${flagIds}) OR ("workspaceId" = ${workspaceId} AND "sourceId" = ANY(${emailIds}))`;
  await sql`DELETE FROM "ClientActivity" WHERE "workspaceId" = ${workspaceId} AND "evidenceItemId" = ANY(${emailIds})`;
  await sql`DELETE FROM "Communication" WHERE "evidenceItemId" = ANY(${emailIds})`;
  await sql`DELETE FROM "EvidenceItem" WHERE id = ANY(${emailIds}) OR id = ${RIACT_SEC_DOCUMENT_REQUEST.id}`;
  await sql`DELETE FROM "CommunicationThread" WHERE id = ANY(${[...new Set(RIACT_EMAIL_MESSAGES.map((m) => m.threadId))]})`;
  await sql`DELETE FROM "Meeting" WHERE id = ANY(${meetingIds})`;
  await sql`DELETE FROM "EmailAlias" WHERE "workspaceId" = ${workspaceId} AND id LIKE 'riact-alias-%'`;
  await sql`DELETE FROM "Client" WHERE "workspaceId" = ${workspaceId} AND (
    id LIKE 'riact-client-%' OR id LIKE 'riact-vc-%' OR id LIKE 'riact-pr-%'
  )`;
  await sql`DELETE FROM "EmailTriageItem" WHERE "workspaceId" = ${workspaceId}`;
  await sql`DELETE FROM "CandidateResponsePack" WHERE "workspaceId" = ${workspaceId}`;
}

async function seedCactusClients(sql: Sql, workspaceId: string, now: Date): Promise<void> {
  for (const client of RIACT_CACTUS_CLIENTS) {
    await sql`
      INSERT INTO "Client" (
        id, "workspaceId", name, status, "lastContactAt", "createdAt", "updatedAt"
      ) VALUES (
        ${client.id},
        ${workspaceId},
        ${client.name},
        'CLIENT',
        ${now},
        ${now},
        ${now}
      )
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        "deletedAt" = NULL,
        "updatedAt" = EXCLUDED."updatedAt"
    `;
    await sql`
      INSERT INTO "EmailAlias" (
        id, "workspaceId", "clientId", address, verified, "createdAt", "updatedAt"
      ) VALUES (
        ${`riact-alias-${client.id}`},
        ${workspaceId},
        ${client.id},
        ${client.email},
        true,
        ${now},
        ${now}
      )
      ON CONFLICT (id) DO UPDATE SET
        address = EXCLUDED.address,
        verified = true,
        "deletedAt" = NULL,
        "updatedAt" = EXCLUDED."updatedAt"
    `;
  }
}

async function seedMailboxConnection(sql: Sql, workspaceId: string, now: Date): Promise<void> {
  await sql`
    INSERT INTO "MailboxConnection" (
      id, "workspaceId", provider, "mailboxAddress", "consentMode", "scopeFolders",
      status, "createdAt", "updatedAt"
    ) VALUES (
      ${RIACT_MAILBOX.connectionId},
      ${workspaceId},
      'GMAIL'::"MailboxProvider",
      ${RIACT_MAILBOX.address},
      'DELEGATED'::"MailboxConsentMode",
      ${["INBOX"]},
      'ACTIVE'::"MailboxSyncStatus",
      ${now},
      ${now}
    )
    ON CONFLICT (id) DO UPDATE SET
      status = 'ACTIVE'::"MailboxSyncStatus",
      "deletedAt" = NULL,
      "updatedAt" = EXCLUDED."updatedAt"
  `;
}

async function seedEmails(sql: Sql, workspaceId: string, now: Date): Promise<void> {
  const threadsSeen = new Set<string>();
  for (const msg of RIACT_EMAIL_MESSAGES) {
    const client = RIACT_CACTUS_CLIENTS.find((c) => c.id === msg.clientId)!;
    const occurredAt = daysBeforeReference(msg.daysBeforeRef, msg.hourUtc ?? 14);
    const from =
      msg.direction === "INBOUND"
        ? client.email
        : RIACT_MAILBOX.address;
    const to =
      msg.direction === "INBOUND"
        ? [RIACT_MAILBOX.address]
        : [client.email];

    const { mime, contentSha256, internetMessageId } = buildRfc822Mime({
      from,
      to,
      subject: msg.subject,
      bodyText: msg.body,
      messageId: msg.id,
      date: occurredAt,
      inReplyTo: msg.inReplyTo,
    });

    const storageUri = mailboxStorageKey(
      workspaceId,
      RIACT_MAILBOX.connectionId,
      msg.id,
    );

    if (!threadsSeen.has(msg.threadId)) {
      threadsSeen.add(msg.threadId);
      await sql`
        INSERT INTO "CommunicationThread" (
          id, "workspaceId", channel, "externalThreadId", subject, participants,
          "createdAt", "updatedAt"
        ) VALUES (
          ${msg.threadId},
          ${workspaceId},
          'EMAIL_GMAIL'::"CommunicationChannel",
          ${msg.threadId},
          ${msg.subject},
          ${JSON.stringify([{ email: client.email, role: "client" }])}::jsonb,
          ${now},
          ${now}
        )
        ON CONFLICT (id) DO UPDATE SET
          subject = EXCLUDED.subject,
          "deletedAt" = NULL,
          "updatedAt" = EXCLUDED."updatedAt"
      `;
    }

    await sql`
      INSERT INTO "EvidenceItem" (
        id, "workspaceId", "clientId", "sourceType", title, "occurredAt",
        "contentSha256", "storageUri", "searchableText", "classificationStatus",
        "createdAt", "updatedAt"
      ) VALUES (
        ${msg.id},
        ${workspaceId},
        ${client.id},
        'EMAIL'::"EvidenceSourceType",
        ${msg.subject},
        ${occurredAt},
        ${contentSha256},
        ${storageUri},
        ${emailSearchable(msg.subject, msg.body)},
        'COMPLETE'::"EvidenceClassificationStatus",
        ${now},
        ${now}
      )
      ON CONFLICT (id) DO UPDATE SET
        title = EXCLUDED.title,
        "occurredAt" = EXCLUDED."occurredAt",
        "contentSha256" = EXCLUDED."contentSha256",
        "storageUri" = EXCLUDED."storageUri",
        "searchableText" = EXCLUDED."searchableText",
        "classificationStatus" = 'COMPLETE'::"EvidenceClassificationStatus",
        "deletedAt" = NULL,
        "updatedAt" = EXCLUDED."updatedAt"
    `;

    await sql`
      INSERT INTO "Communication" (
        id, "threadId", "evidenceItemId", direction, "sentAt",
        "fromAddress", "toAddresses", "ccAddresses", "internetMessageId",
        "bodyText", "createdAt", "updatedAt"
      ) VALUES (
        ${`riact-comm-${msg.id}`},
        ${msg.threadId},
        ${msg.id},
        ${msg.direction}::"CommunicationDirection",
        ${occurredAt},
        ${from},
        ${to},
        ${[]},
        ${internetMessageId},
        ${msg.body},
        ${now},
        ${now}
      )
      ON CONFLICT (id) DO UPDATE SET
        "bodyText" = EXCLUDED."bodyText",
        "deletedAt" = NULL,
        "updatedAt" = EXCLUDED."updatedAt"
    `;

    await sql`
      INSERT INTO "ClientActivity" (
        id, "workspaceId", "clientId", type, "occurredAt", title, direction,
        counterparties, "evidenceItemId", "threadId", "contentSha256",
        "createdAt", "updatedAt"
      ) VALUES (
        ${`riact-activity-${msg.id}`},
        ${workspaceId},
        ${client.id},
        ${msg.direction === "INBOUND" ? "EMAIL_RECEIVED" : "EMAIL_SENT"},
        ${occurredAt},
        ${msg.subject},
        ${msg.direction}::"CommunicationDirection",
        ${msg.direction === "INBOUND" ? [client.email] : [client.email]},
        ${msg.id},
        ${msg.threadId},
        ${contentSha256},
        ${now},
        ${now}
      )
      ON CONFLICT (id) DO UPDATE SET
        "occurredAt" = EXCLUDED."occurredAt",
        "deletedAt" = NULL,
        "updatedAt" = EXCLUDED."updatedAt"
    `;

    await sql`
      INSERT INTO "EvidenceClassification" (
        id, "workspaceId", "evidenceItemId", "communicationId", "contentHash",
        result, "modelId", "promptVersion", "signalCount", "rawResponse",
        "createdAt", "updatedAt"
      ) VALUES (
        ${`riact-class-${msg.id}`},
        ${workspaceId},
        ${msg.id},
        ${`riact-comm-${msg.id}`},
        ${contentSha256},
        ${msg.flag ? "FLAGGED" : "CLEAN"},
        'riact-seed',
        'email-taxonomy-v1',
        ${msg.flag ? 1 : 0},
        ${JSON.stringify(
          msg.flag
            ? {
                clean: false,
                signals: [
                  {
                    category: msg.flag.type,
                    severity: msg.flag.severity,
                    confidence: 0.9,
                    excerpt: msg.body.slice(0, 120),
                    rationale: "Seeded classification for demo",
                  },
                ],
              }
            : { clean: true, signals: [] },
        )}::jsonb,
        ${now},
        ${now}
      )
      ON CONFLICT (id) DO UPDATE SET
        "contentHash" = EXCLUDED."contentHash",
        result = EXCLUDED.result,
        "updatedAt" = EXCLUDED."updatedAt"
    `;

    if (msg.flag) {
      const flagId = `riact-email-flag-${msg.id}`;
      await sql`
        INSERT INTO "Flag" (
          id, "workspaceId", "sourceType", "sourceId", "communicationId",
          type, severity, status, "createdAt", "resolvedAt", "resolutionType",
          "resolutionNote", "dedupeKey", evidence, "updatedAt"
        ) VALUES (
          ${flagId},
          ${workspaceId},
          'EMAIL',
          ${msg.threadId},
          ${`riact-comm-${msg.id}`},
          ${msg.flag.type}::"FlagType",
          ${msg.flag.severity}::"FlagSeverity",
          ${msg.flag.status}::"FlagStatus",
          ${occurredAt},
          ${msg.flag.status === "CLOSED" ? daysBeforeReference(msg.daysBeforeRef - 1) : null},
          ${msg.flag.resolutionType ?? null}::"FlagResolutionType",
          ${msg.flag.resolutionNote ?? null},
          ${`email:${msg.id}:${msg.flag.type}`},
          ${JSON.stringify({
            excerpt: msg.body.slice(0, 120),
            contentSha256,
            evidenceItemId: msg.id,
          })}::jsonb,
          ${now}
        )
        ON CONFLICT (id) DO UPDATE SET
          status = EXCLUDED.status,
          "updatedAt" = EXCLUDED."updatedAt"
      `;
    }

    void mime;
  }
}

async function seedMeetings(sql: Sql, workspaceId: string, now: Date): Promise<void> {
  for (const [index, mtg] of RIACT_MEETINGS.entries()) {
    const meetingDate = daysBeforeReference(mtg.daysBeforeRef);
    const draftReadyAt = new Date(meetingDate.getTime() + 3_600_000);
    const finalizedAt = new Date(meetingDate.getTime() + 86_400_000);
    const advisor = RIACT_ADVISORS[index % RIACT_ADVISORS.length]!;
    const topicText = mtg.topics.join(" ");
    const advisorLine = `Today we covered ${topicText} with ${mtg.clientName}. Advisory fee schedule and suitability were reviewed where applicable.`;
    const clientLine = "That sounds good. Please send the follow-up in writing.";
    const transcript = JSON.stringify({
      segments: [
        { startTime: 12, endTime: 48, speaker: "Advisor", text: advisorLine },
        { startTime: 49, endTime: 78, speaker: "Client", text: clientLine },
      ],
      duration: 78,
    });
    const extraction = JSON.stringify({
      topics: mtg.topics,
      disclosures: [{ text: "Advisory fee schedule reviewed", startTime: 12 }],
      followUps: [{ text: "Email follow-up summary", startTime: 49 }],
    });
    const searchableText = `${mtg.clientName} ${mtg.meetingType} ${topicText} ${advisorLine}`
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();

    await sql`
      INSERT INTO "Meeting" (
        id, "workspaceId", "clientId", "clientName", "meetingType", "meetingDate",
        status, "draftReadyAt", "finalizedAt", "timeToFinalize", "finalizeReason",
        "searchableText", transcript, extraction, "participantEmails",
        "clientMatchConfidence", "advisorCertifiedByUserId", "advisorCertifiedAt",
        "createdAt", "updatedAt"
      ) VALUES (
        ${mtg.id},
        ${workspaceId},
        ${mtg.clientId},
        ${mtg.clientName},
        ${mtg.meetingType},
        ${meetingDate},
        'FINALIZED'::"MeetingStatus",
        ${draftReadyAt},
        ${finalizedAt},
        82800,
        'COMPLETE_REVIEW'::"FinalizeReason",
        ${searchableText},
        ${transcript}::jsonb,
        ${extraction}::jsonb,
        ${[RIACT_CACTUS_CLIENTS.find((c) => c.id === mtg.clientId)?.email ?? ""]},
        'EMAIL'::"MeetingClientMatchConfidence",
        ${advisor.id},
        ${finalizedAt},
        ${now},
        ${now}
      )
      ON CONFLICT (id) DO UPDATE SET
        "searchableText" = EXCLUDED."searchableText",
        transcript = EXCLUDED.transcript,
        extraction = EXCLUDED.extraction,
        "advisorCertifiedByUserId" = EXCLUDED."advisorCertifiedByUserId",
        "advisorCertifiedAt" = EXCLUDED."advisorCertifiedAt",
        "updatedAt" = EXCLUDED."updatedAt"
    `;

    if (mtg.flag) {
      await sql`
        INSERT INTO "Flag" (
          id, "workspaceId", "meetingId", "sourceType", "sourceId",
          type, severity, status, "createdAt", "resolvedAt", "resolutionType",
          "resolutionNote", evidence, "updatedAt"
        ) VALUES (
          ${mtg.flag.id},
          ${workspaceId},
          ${mtg.id},
          'MEETING',
          ${mtg.id},
          ${mtg.flag.type}::"FlagType",
          ${mtg.flag.severity}::"FlagSeverity",
          ${mtg.flag.status}::"FlagStatus",
          ${meetingDate},
          ${mtg.flag.status === "CLOSED" ? finalizedAt : null},
          ${mtg.flag.resolutionType ?? null}::"FlagResolutionType",
          ${mtg.flag.resolutionNote ?? null},
          ${JSON.stringify({ rationale: topicText })}::jsonb,
          ${now}
        )
        ON CONFLICT (id) DO UPDATE SET
          status = EXCLUDED.status,
          "updatedAt" = EXCLUDED."updatedAt"
      `;
    }
  }
}

async function seedSecDocument(sql: Sql, workspaceId: string, now: Date): Promise<void> {
  const occurredAt = new Date(RIACT_SEC_DOCUMENT_REQUEST.occurredAtIso);
  const hash = createHash("sha256")
    .update(`${RIACT_SEC_DOCUMENT_REQUEST.title}\n${RIACT_SEC_DOCUMENT_REQUEST.body}`, "utf8")
    .digest("hex");
  await sql`
    INSERT INTO "EvidenceItem" (
      id, "workspaceId", "clientId", "sourceType", title, "occurredAt",
      "contentSha256", "searchableText", "classificationStatus", "createdAt", "updatedAt"
    ) VALUES (
      ${RIACT_SEC_DOCUMENT_REQUEST.id},
      ${workspaceId},
      ${RIACT_CACTUS_CLIENTS[0]!.id},
      'DOCUMENT'::"EvidenceSourceType",
      ${RIACT_SEC_DOCUMENT_REQUEST.title},
      ${occurredAt},
      ${hash},
      ${emailSearchable(RIACT_SEC_DOCUMENT_REQUEST.title, RIACT_SEC_DOCUMENT_REQUEST.body)},
      'COMPLETE'::"EvidenceClassificationStatus",
      ${now},
      ${now}
    )
    ON CONFLICT (id) DO UPDATE SET
      "contentSha256" = EXCLUDED."contentSha256",
      "searchableText" = EXCLUDED."searchableText",
      "updatedAt" = EXCLUDED."updatedAt"
  `;
}

async function seedCoverageManifest(sql: Sql, workspaceId: string, now: Date): Promise<void> {
  const emailCount = RIACT_EMAIL_MESSAGES.length;
  const meetingCount = RIACT_MEETINGS.length;
  const sources = JSON.stringify([
    {
      sourceType: "EMAIL",
      from: RIACT_CORPUS_FROM_ISO,
      to: RIACT_CORPUS_TO_ISO,
      chunkCount: emailCount,
    },
    {
      sourceType: "MEETING",
      from: RIACT_CORPUS_FROM_ISO,
      to: RIACT_CORPUS_TO_ISO,
      chunkCount: meetingCount,
    },
  ]);
  const gapPeriods = JSON.stringify([
    {
      sourceType: "EMAIL",
      from: RIACT_COVERAGE_GAP.from,
      to: RIACT_COVERAGE_GAP.to,
      reason: RIACT_COVERAGE_GAP.reason,
    },
    {
      sourceType: "MEETING",
      from: RIACT_COVERAGE_GAP.from,
      to: RIACT_COVERAGE_GAP.to,
      reason: RIACT_COVERAGE_GAP.reason,
    },
  ]);
  const unindexedSources = JSON.stringify([
    { name: RIACT_SMS_SOURCE.name, reason: RIACT_SMS_SOURCE.reason },
  ]);

  await sql`
    INSERT INTO "IndexCoverageManifest" (
      id, "workspaceId", sources, "gapPeriods", "unindexedSources", "lastIndexedAt",
      "createdAt", "updatedAt"
    ) VALUES (
      ${"riact-coverage-manifest"},
      ${workspaceId},
      ${sources}::jsonb,
      ${gapPeriods}::jsonb,
      ${unindexedSources}::jsonb,
      ${now},
      ${now},
      ${now}
    )
    ON CONFLICT ("workspaceId") DO UPDATE SET
      sources = EXCLUDED.sources,
      "gapPeriods" = EXCLUDED."gapPeriods",
      "unindexedSources" = EXCLUDED."unindexedSources",
      "lastIndexedAt" = EXCLUDED."lastIndexedAt",
      "deletedAt" = NULL,
      "updatedAt" = EXCLUDED."updatedAt"
  `;
}

async function seedSmsSourceRegistration(sql: Sql, workspaceId: string, now: Date): Promise<void> {
  await sql`
    INSERT INTO "IngestJob" (
      id, "workspaceId", kind, status, stats, "createdAt", "updatedAt"
    ) VALUES (
      ${RIACT_SMS_SOURCE.id},
      ${workspaceId},
      'MESSAGE_IMPORT'::"IngestJobKind",
      'QUEUED'::"IngestJobStatus",
      ${JSON.stringify({
        channel: "SMS_IMPORT",
        registered: true,
        indexed: false,
        label: RIACT_SMS_SOURCE.displayLabel,
        note: RIACT_SMS_SOURCE.reason,
      })}::jsonb,
      ${now},
      ${now}
    )
    ON CONFLICT (id) DO UPDATE SET
      stats = EXCLUDED.stats,
      status = 'QUEUED'::"IngestJobStatus",
      "updatedAt" = EXCLUDED."updatedAt"
  `;
}

async function seedThinFirm(
  sql: Sql,
  firm: (typeof RIACT_CLIENT_FIRMS)[number],
  now: Date,
): Promise<void> {
  const clients = RIACT_THIN_CLIENTS[firm.workspaceId as keyof typeof RIACT_THIN_CLIENTS];
  if (!clients) return;
  for (const client of clients) {
    await sql`
      INSERT INTO "Client" (
        id, "workspaceId", name, status, "lastContactAt", "createdAt", "updatedAt"
      ) VALUES (
        ${client.id},
        ${firm.workspaceId},
        ${client.name},
        'CLIENT',
        ${now},
        ${now},
        ${now}
      )
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        "deletedAt" = NULL,
        "updatedAt" = EXCLUDED."updatedAt"
    `;
  }
}

async function seedAuditBootstrap(sql: Sql, workspaceId: string, now: Date): Promise<void> {
  await sql`
    INSERT INTO "AuditEvent" (
      id, "workspaceId", "userId", action, "resourceType", "resourceId", metadata, timestamp
    ) VALUES (
      ${"riact-audit-bootstrap"},
      ${workspaceId},
      ${RIACT_DEMO_USER.id},
      'WORKSPACE_CREATED',
      'workspace',
      ${workspaceId},
      ${JSON.stringify({ tenant: "RIACT", synthetic: true })}::jsonb,
      ${now}
    )
    ON CONFLICT (id) DO NOTHING
  `;
}

/**
 * Assign supervisory outcomes so the dashboard selectivity strip is non-zero.
 * Open / in-remediation flags → ESCALATED (priority findings); rest mostly CLEARED.
 */
async function seedSupervisionOutcomes(
  sql: Sql,
  workspaceId: string,
  now: Date,
): Promise<void> {
  const openStatuses = ["OPEN", "IN_REMEDIATION", "PENDING_VERIFICATION"];

  await sql`
    UPDATE "Meeting" m
    SET
      "supervisoryOutcome" = 'ESCALATED'::"SupervisoryOutcome",
      "outcomeReason" = 'Open compliance finding requires CCO review',
      "outcomeConfidence" = 0.92,
      "processedAt" = COALESCE(m."meetingDate", ${now}),
      "primaryControlId" = f.type::text,
      "updatedAt" = ${now}
    FROM "Flag" f
    WHERE m.id = f."meetingId"
      AND m."workspaceId" = ${workspaceId}
      AND f."workspaceId" = ${workspaceId}
      AND f.status::text = ANY(${openStatuses})
  `;

  await sql`
    UPDATE "CommunicationThread" t
    SET
      "supervisoryOutcome" = 'ESCALATED'::"SupervisoryOutcome",
      "outcomeReason" = 'Open email finding requires CCO review',
      "outcomeConfidence" = 0.9,
      "processedAt" = COALESCE(t."updatedAt", ${now}),
      "primaryControlId" = f.type::text,
      "updatedAt" = ${now}
    FROM "Communication" c
    JOIN "Flag" f ON f."communicationId" = c.id
    WHERE t.id = c."threadId"
      AND t."workspaceId" = ${workspaceId}
      AND f."workspaceId" = ${workspaceId}
      AND f.status::text = ANY(${openStatuses})
  `;

  // One routine sample meeting (first without an open flag).
  await sql`
    UPDATE "Meeting"
    SET
      "supervisoryOutcome" = 'ROUTINE_SAMPLE'::"SupervisoryOutcome",
      "outcomeReason" = 'Control sampling selection',
      "outcomeConfidence" = 0.8,
      "processedAt" = COALESCE("meetingDate", ${now}),
      "updatedAt" = ${now}
    WHERE id = (
      SELECT m.id FROM "Meeting" m
      WHERE m."workspaceId" = ${workspaceId}
        AND m."supervisoryOutcome" IS NULL
      ORDER BY m."meetingDate" ASC
      LIMIT 1
    )
  `;

  // One held thread for the Held metric.
  await sql`
    UPDATE "CommunicationThread"
    SET
      "supervisoryOutcome" = 'HELD'::"SupervisoryOutcome",
      "outcomeReason" = 'Awaiting identity confirmation before disposition',
      "outcomeConfidence" = 0.7,
      "heldReason" = 'REQUIRED_CLIENT_CONTEXT_UNRESOLVED'::"SupervisoryHoldReason",
      "processedAt" = COALESCE("updatedAt", ${now}),
      "updatedAt" = ${now}
    WHERE id = (
      SELECT t.id FROM "CommunicationThread" t
      WHERE t."workspaceId" = ${workspaceId}
        AND t."deletedAt" IS NULL
        AND t."supervisoryOutcome" IS NULL
      ORDER BY t.id ASC
      LIMIT 1
    )
  `;

  await sql`
    UPDATE "Meeting"
    SET
      "supervisoryOutcome" = 'CLEARED'::"SupervisoryOutcome",
      "outcomeReason" = 'No material findings after review',
      "outcomeConfidence" = 0.88,
      "processedAt" = COALESCE("meetingDate", ${now}),
      "updatedAt" = ${now}
    WHERE "workspaceId" = ${workspaceId}
      AND "supervisoryOutcome" IS NULL
  `;

  await sql`
    UPDATE "CommunicationThread"
    SET
      "supervisoryOutcome" = 'CLEARED'::"SupervisoryOutcome",
      "outcomeReason" = 'No material findings after review',
      "outcomeConfidence" = 0.86,
      "processedAt" = COALESCE("updatedAt", ${now}),
      "updatedAt" = ${now}
    WHERE "workspaceId" = ${workspaceId}
      AND "deletedAt" IS NULL
      AND "supervisoryOutcome" IS NULL
  `;
}

async function seedOpenRemediation(
  sql: Sql,
  workspaceId: string,
  now: Date,
): Promise<void> {
  const openFlags = await sql`
    SELECT f.id, f."meetingId", f.type::text AS type
    FROM "Flag" f
    WHERE f."workspaceId" = ${workspaceId}
      AND f.status::text IN ('OPEN', 'IN_REMEDIATION', 'PENDING_VERIFICATION')
  `;

  for (const flag of openFlags as Array<{
    id: string;
    meetingId: string | null;
    type: string;
  }>) {
    const resolutionId = `riact-res-${flag.id}`;
    const taskId = `riact-task-${flag.id}`;
    await sql`
      INSERT INTO "ResolutionRecord" (
        id, "workspaceId", "meetingId", "flagId", "resolutionType", rationale,
        "createdByUserId", metadata, "createdAt", "updatedAt"
      ) VALUES (
        ${resolutionId},
        ${workspaceId},
        ${flag.meetingId},
        ${flag.id},
        ${"FOLLOW_UP_REQUIRED"}::"FlagResolutionType",
        ${`Remediate ${flag.type} finding before closing`},
        ${RIACT_DEMO_USER.id},
        ${JSON.stringify({ synthetic: true, tenant: "RIACT" })}::jsonb,
        ${now},
        ${now}
      )
      ON CONFLICT ("flagId") DO UPDATE SET
        rationale = EXCLUDED.rationale,
        "updatedAt" = EXCLUDED."updatedAt"
    `;
    await sql`
      INSERT INTO "ActionItem" (
        id, "resolutionId", title, status, "ownerId", "dueDate", required,
        "createdAt", "updatedAt"
      ) VALUES (
        ${taskId},
        ${resolutionId},
        ${`Complete remediation for ${flag.type}`},
        ${"OPEN"}::"RemediationTaskStatus",
        ${RIACT_DEMO_USER.id},
        ${new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000)},
        true,
        ${now},
        ${now}
      )
      ON CONFLICT (id) DO UPDATE SET
        status = ${"OPEN"}::"RemediationTaskStatus",
        "updatedAt" = EXCLUDED."updatedAt"
    `;
  }
}

async function countSeedArtifacts(sql: Sql, workspaceId: string): Promise<Record<string, number>> {
  const [emails, meetings, flags, clients, triage] = await Promise.all([
    sql`SELECT count(*)::int AS c FROM "EvidenceItem" WHERE "workspaceId" = ${workspaceId} AND "sourceType" = 'EMAIL' AND "deletedAt" IS NULL`,
    sql`SELECT count(*)::int AS c FROM "Meeting" WHERE "workspaceId" = ${workspaceId}`,
    sql`SELECT count(*)::int AS c FROM "Flag" WHERE "workspaceId" = ${workspaceId}`,
    sql`SELECT count(*)::int AS c FROM "Client" WHERE "workspaceId" = ${workspaceId} AND "deletedAt" IS NULL`,
    sql`SELECT count(*)::int AS c FROM "EmailTriageItem" WHERE "workspaceId" = ${workspaceId} AND status = 'PENDING'`,
  ]);
  return {
    emails: (emails[0] as { c: number }).c,
    meetings: (meetings[0] as { c: number }).c,
    flags: (flags[0] as { c: number }).c,
    clients: (clients[0] as { c: number }).c,
    triagePending: (triage[0] as { c: number }).c,
  };
}

async function main(): Promise<void> {
  const { confirm, embed } = parseArgs(process.argv.slice(2));
  if (!confirm) {
    console.error("Usage: npx tsx scripts/seed-riact.ts --confirm [--embed]");
    process.exit(1);
  }
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }

  const sql = neon(process.env.DATABASE_URL);
  const now = refDate();

  console.log("Seeding RIACT partner-demo tenant…");

  await upsertDemoUser(sql, now);

  await upsertWorkspace(sql, {
    id: RIACT_PARENT_PRACTICE.workspaceId,
    name: RIACT_PARENT_PRACTICE.name,
    now,
  });
  await upsertFirmProfile(sql, {
    id: RIACT_PARENT_PRACTICE.firmProfileId,
    workspaceId: RIACT_PARENT_PRACTICE.workspaceId,
    crdNumber: RIACT_PARENT_PRACTICE.crdNumber,
    ccoName: RIACT_PARENT_PRACTICE.ccoName,
    aumUsd: 0,
    now,
  });
  await linkOwnerCco(sql, RIACT_PARENT_PRACTICE.workspaceId);

  for (const firm of RIACT_CLIENT_FIRMS) {
    await upsertWorkspace(sql, { id: firm.workspaceId, name: firm.name, now });
    await upsertFirmProfile(sql, {
      id: firm.firmProfileId,
      workspaceId: firm.workspaceId,
      crdNumber: firm.crdNumber,
      ccoName: firm.ccoName,
      aumUsd: firm.aumUsd,
      now,
    });
    await linkOwnerCco(sql, firm.workspaceId);
    if (!firm.primary) {
      await seedThinFirm(sql, firm, now);
    }
  }

  const primaryWs = riactPrimaryWorkspaceId();
  await clearCactusArtifacts(sql, primaryWs);
  await seedAdvisors(sql, primaryWs, now);
  await seedCactusClients(sql, primaryWs, now);
  await seedMailboxConnection(sql, primaryWs, now);
  await seedEmails(sql, primaryWs, now);
  await seedMeetings(sql, primaryWs, now);
  await seedSecDocument(sql, primaryWs, now);
  await seedCoverageManifest(sql, primaryWs, now);
  await seedSmsSourceRegistration(sql, primaryWs, now);
  await seedSupervisionOutcomes(sql, primaryWs, now);
  await seedOpenRemediation(sql, primaryWs, now);
  await seedAuditBootstrap(sql, primaryWs, now);

  const counts = await countSeedArtifacts(sql, primaryWs);

  console.log("\nRIACT seed complete.");
  console.log({
    referenceDate: RIACT_REFERENCE_DATE_ISO,
    primaryWorkspace: primaryWs,
    ...counts,
    emailMessages: RIACT_EMAIL_MESSAGES.length,
    threads: new Set(RIACT_EMAIL_MESSAGES.map((m) => m.threadId)).size,
  });

  console.log("\n── Demo access ──");
  console.log(`  URL:   /demo/riact`);
  console.log(`  Email: ${RIACT_DEMO_USER.email}`);
  console.log(`  Pass:  ${RIACT_DEMO_USER.password}`);
  console.log(`  Role:  Owner/CCO on Sonoran + all client firms`);
  console.log(`  Active workspace after login: Cactus Wren Advisory`);

  console.log("\n── Demo moment A (Candidate Pack) ──");
  console.log(`  Paste: ${RIACT_SEC_DOCUMENT_REQUEST.requestItemText}`);

  console.log("\n── Demo moment B (fail-closed SMS) ──");
  console.log(`  Question: ${RIACT_SMS_REFUSAL_QUESTION}`);

  console.log("\n── Demo moment C (grounded citations) ──");
  console.log(`  Question: ${RIACT_CITATION_QUESTION}`);

  if (embed) {
    const { spawnSync } = await import("node:child_process");
    const r = spawnSync(
      "npx",
      ["tsx", "scripts/demo-embed-backfill.ts", primaryWs],
      { stdio: "inherit", env: process.env },
    );
    if (r.status !== 0) {
      console.error("Embed backfill failed — run manually:");
      console.error(`  npx tsx scripts/demo-embed-backfill.ts ${primaryWs}`);
      process.exit(1);
    }
  } else {
    console.log(`\nNext: npx tsx scripts/demo-embed-backfill.ts ${primaryWs}`);
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
