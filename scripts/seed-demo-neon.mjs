/**
 * One-shot partner-demo reseed via Neon HTTP (works when Prisma TCP TLS fails).
 * Soft-deletes only. Does not hard-delete compliance records.
 */
import crypto from "node:crypto";
import { neon } from "@neondatabase/serverless";

const WORKSPACE_ID = process.argv[2];
const DATABASE_URL = process.env.DATABASE_URL;
if (!WORKSPACE_ID || process.argv[3] !== "--confirm" || !DATABASE_URL) {
  console.error(
    "Usage: DATABASE_URL=... node scripts/seed-demo-neon.mjs <workspaceId> --confirm"
  );
  process.exit(1);
}

process.env.NODE_TLS_REJECT_UNAUTHORIZED ??= "0";

const sql = neon(DATABASE_URL);

const DEMO_FIRM = {
  workspaceName: "A Small Investment, LLC",
  crdNumber: "332816",
  ccoName: "André J. Small",
  aumUsd: 8_400_000,
};

const CLIENTS = [
  {
    name: "Margaret Ellison",
    email: "margaret.ellison@example.com",
    feeBody:
      "Hi team - I am unhappy about what we charge. The 1.25% advisory fee feels high versus last year. Can we revisit the fee schedule before the April review?",
    lastTopic: "quarterly portfolio rebalance and tax-loss harvesting plan",
    // Demo: open email signal in Review Queue
    emailFlag: {
      type: "FEE_DISPUTE",
      severity: "WARN",
      excerpt: "I am unhappy about what we charge. The 1.25% advisory fee feels high",
      rationale:
        "Client expressed dissatisfaction with advisory fees and asked to revisit the fee schedule.",
    },
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

const ADVICE_EMAIL = {
  clientName: "James Whitfield",
  subject: "Pension consolidation recommendation",
  body: "Hey James Whitfield - we are advising you to move your pension funds into our discretionary managed account this week. Please confirm so we can place the trade.",
  flag: {
    type: "TRADE_INSTRUCTION",
    severity: "CRITICAL",
    excerpt:
      "advising you to move your pension funds into our discretionary managed account this week. Please confirm so we can place the trade.",
    rationale:
      "Outbound message contains an investment recommendation and a request to confirm a trade instruction by email.",
  },
};

function cuid() {
  return "c" + crypto.randomBytes(12).toString("hex");
}

function daysAgo(days, hour = 14) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  d.setUTCHours(hour, 0, 0, 0);
  return d.toISOString();
}

function sha256(text) {
  return crypto.createHash("sha256").update(text, "utf8").digest("hex");
}

function emailSearchable(subject, body) {
  return `${subject} ${body}`.replace(/\s+/g, " ").trim().toLowerCase();
}

const now = new Date().toISOString();

const ws = await sql`select id, name from "Workspace" where id = ${WORKSPACE_ID}`;
if (!ws[0]) {
  console.error("Workspace not found");
  process.exit(1);
}
console.log(`Seeding ${ws[0].name} (${WORKSPACE_ID})`);

// Soft-delete correspondence + clients + test mailbox
await sql`update "Communication" c set "deletedAt" = ${now}::timestamptz
  from "EvidenceItem" e
  where c."evidenceItemId" = e.id and e."workspaceId" = ${WORKSPACE_ID} and c."deletedAt" is null`;
await sql`update "CommunicationThread" set "deletedAt" = ${now}::timestamptz
  where "workspaceId" = ${WORKSPACE_ID} and "deletedAt" is null`;
await sql`update "EvidenceItem" set "deletedAt" = ${now}::timestamptz
  where "workspaceId" = ${WORKSPACE_ID} and "deletedAt" is null`;
await sql`update "ClientActivity" set "deletedAt" = ${now}::timestamptz
  where "workspaceId" = ${WORKSPACE_ID} and "deletedAt" is null`;
await sql`update "EmailAlias" set "deletedAt" = ${now}::timestamptz
  where "workspaceId" = ${WORKSPACE_ID} and "deletedAt" is null`;
await sql`update "Client" set "deletedAt" = ${now}::timestamptz
  where "workspaceId" = ${WORKSPACE_ID} and "deletedAt" is null`;
await sql`delete from "EmailTriageItem" where "workspaceId" = ${WORKSPACE_ID}`;
await sql`update "MailboxConnection" set "deletedAt" = ${now}::timestamptz
  where "workspaceId" = ${WORKSPACE_ID} and "deletedAt" is null
    and ("mailboxAddress" ilike '%complyvaultco%' or "mailboxAddress" ilike '%gmail.com%')`;

// Close stale flags
await sql`update "Flag" set
  status = 'CLOSED',
  "resolvedAt" = ${daysAgo(1)}::timestamptz,
  "resolutionType" = 'ADD_CONTEXT',
  "resolutionNote" = 'Demo reseed - closed for healthy queue metrics',
  "updatedAt" = ${now}::timestamptz
  where "workspaceId" = ${WORKSPACE_ID}
    and status in ('OPEN','IN_REMEDIATION','PENDING_VERIFICATION')`;

// Heal meetings
await sql`update "Meeting" set
  status = 'FINALIZED',
  "clientId" = null,
  "clientName" = 'Prior engagement (archived)',
  "clientMatchConfidence" = null,
  "draftReadyAt" = ${daysAgo(3)}::timestamptz,
  "finalizedAt" = ${daysAgo(2)}::timestamptz,
  "timeToFinalize" = 86400,
  "finalizeReason" = 'COMPLETE_REVIEW',
  "searchableText" = 'prior engagement archived demo reseed',
  "updatedAt" = ${now}::timestamptz
  where "workspaceId" = ${WORKSPACE_ID}`;

// Firm identity
await sql`update "Workspace" set name = ${DEMO_FIRM.workspaceName}, "updatedAt" = ${now}::timestamptz
  where id = ${WORKSPACE_ID}`;
const fp = await sql`select id from "FirmProfile" where "workspaceId" = ${WORKSPACE_ID}`;
if (fp[0]) {
  await sql`update "FirmProfile" set
    "crdNumber" = ${DEMO_FIRM.crdNumber},
    "ccoName" = ${DEMO_FIRM.ccoName},
    "aumUsd" = ${DEMO_FIRM.aumUsd},
    status = 'ACTIVE',
    "setupCompletedAt" = ${now}::timestamptz,
    "deletedAt" = null,
    "updatedAt" = ${now}::timestamptz
    where "workspaceId" = ${WORKSPACE_ID}`;
} else {
  await sql`insert into "FirmProfile"
    (id, "workspaceId", status, "crdNumber", "ccoName", "aumUsd", "setupCompletedAt", "createdAt", "updatedAt")
    values (${cuid()}, ${WORKSPACE_ID}, 'ACTIVE', ${DEMO_FIRM.crdNumber}, ${DEMO_FIRM.ccoName},
      ${DEMO_FIRM.aumUsd}, ${now}::timestamptz, ${now}::timestamptz, ${now}::timestamptz)`;
}

const created = [];
for (const [i, c] of CLIENTS.entries()) {
  const clientId = cuid();
  await sql`insert into "Client"
    (id, "workspaceId", name, status, "lastContactAt", "createdAt", "updatedAt")
    values (${clientId}, ${WORKSPACE_ID}, ${c.name}, 'CLIENT', ${daysAgo(1)}::timestamptz,
      ${now}::timestamptz, ${now}::timestamptz)`;
  await sql`insert into "EmailAlias"
    (id, "workspaceId", address, "clientId", verified, "createdAt", "updatedAt")
    values (${cuid()}, ${WORKSPACE_ID}, ${c.email}, ${clientId}, true, ${now}::timestamptz, ${now}::timestamptz)`;

  const meetingId = cuid();
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
  const transcript = JSON.stringify({
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
  });
  const extraction = JSON.stringify({
    topics: [c.lastTopic, "fee disclosure"],
    recommendations: [],
    disclosures: [{ text: "Advisory fee schedule reviewed", startTime: 41 }],
    decisions: [],
    followUps: [{ text: "Email fee brochure", startTime: 70 }],
  });

  await sql`insert into "Meeting"
    (id, "workspaceId", "clientName", "clientId", "clientMatchConfidence", "participantEmails",
     "meetingType", "meetingDate", status, "draftReadyAt", "finalizedAt", "timeToFinalize",
     "finalizeReason", "searchableText", transcript, extraction, "readyForCCO", "createdAt", "updatedAt")
    values (${meetingId}, ${WORKSPACE_ID}, ${c.name}, ${clientId}, 'EMAIL', ${[c.email]}::text[],
      'Annual Review', ${meetingDate}::timestamptz, 'FINALIZED', ${draftReadyAt}::timestamptz,
      ${finalizedAt}::timestamptz, 86400, 'COMPLETE_REVIEW', ${searchableText},
      ${transcript}::jsonb, ${extraction}::jsonb, false, ${now}::timestamptz, ${now}::timestamptz)`;

  if (i < 3) {
    const flagCreated = daysAgo(i === 0 ? 1 : 2);
    await sql`insert into "Flag"
      (id, "workspaceId", "meetingId", "sourceType", "sourceId", type, severity, status, evidence,
       "createdByType", "createdAt", "updatedAt")
      values (${cuid()}, ${WORKSPACE_ID}, ${meetingId}, 'MEETING', ${meetingId},
        ${i === 0 ? "MISSING_DISCLOSURE" : "CONFLICT_LANGUAGE"}, 'WARN', 'OPEN',
        ${JSON.stringify({ excerpt: "Demo seed flag - recent open item for queue health" })}::jsonb,
        'SYSTEM', ${flagCreated}::timestamptz, ${now}::timestamptz)`;
  }

  await sql`insert into "Flag"
    (id, "workspaceId", "meetingId", "sourceType", "sourceId", type, severity, status,
     "resolutionType", "resolutionNote", "resolvedAt", "createdByType", "createdAt", "updatedAt")
    values (${cuid()}, ${WORKSPACE_ID}, ${meetingId}, 'MEETING', ${meetingId},
      'MISSING_SUITABILITY_BASIS', 'INFO', 'CLOSED', 'ADD_CONTEXT', 'Suitability memo attached',
      ${daysAgo(4)}::timestamptz, 'SYSTEM', ${daysAgo(5)}::timestamptz, ${now}::timestamptz)`;

  const feeSubject = `Fee schedule question - ${c.name}`;
  const feeHash = sha256(`${feeSubject}\n${c.feeBody}\n${c.email}`);
  const feeOccurredAt = daysAgo(10 + i);
  const threadId = cuid();
  const evidenceId = cuid();
  const communicationId = cuid();
  const searchable = emailSearchable(feeSubject, c.feeBody);
  await sql`insert into "CommunicationThread"
    (id, "workspaceId", channel, "externalThreadId", subject, participants, "createdAt", "updatedAt")
    values (${threadId}, ${WORKSPACE_ID}, 'EMAIL_GMAIL', ${`demo-fee-${clientId}`}, ${feeSubject},
      ${JSON.stringify([{ email: c.email, role: "client" }])}::jsonb,
      ${now}::timestamptz, ${now}::timestamptz)`;
  await sql`insert into "EvidenceItem"
    (id, "workspaceId", "clientId", "sourceType", title, "occurredAt", "contentSha256",
     "searchableText", "classificationStatus", "createdAt", "updatedAt")
    values (${evidenceId}, ${WORKSPACE_ID}, ${clientId}, 'EMAIL', ${feeSubject},
      ${feeOccurredAt}::timestamptz, ${feeHash}, ${searchable}, 'COMPLETE',
      ${now}::timestamptz, ${now}::timestamptz)`;
  await sql`insert into "Communication"
    (id, "threadId", "evidenceItemId", direction, "sentAt", "fromAddress", "toAddresses",
     "ccAddresses", "bodyText", "internetMessageId", "createdAt", "updatedAt")
    values (${communicationId}, ${threadId}, ${evidenceId}, 'INBOUND', ${feeOccurredAt}::timestamptz,
      ${c.email}, ${["compliance@demo.complyvault.co"]}::text[], '{}'::text[], ${c.feeBody},
      ${`<demo-fee-${clientId}@example.com>`}, ${now}::timestamptz, ${now}::timestamptz)`;
  await sql`insert into "ClientActivity"
    (id, "workspaceId", "clientId", type, "occurredAt", title, direction, counterparties,
     "evidenceItemId", "threadId", "contentSha256", "createdAt", "updatedAt")
    values (${cuid()}, ${WORKSPACE_ID}, ${clientId}, 'EMAIL_RECEIVED', ${feeOccurredAt}::timestamptz,
      ${feeSubject}, 'INBOUND', ${[c.email]}::text[], ${evidenceId}, ${threadId}, ${feeHash},
      ${now}::timestamptz, ${now}::timestamptz)`;

  if (c.emailFlag) {
    const classId = cuid();
    await sql`insert into "EvidenceClassification"
      (id, "workspaceId", "evidenceItemId", "communicationId", "contentHash", result, "modelId",
       "promptVersion", "signalCount", "rawResponse", "createdAt", "updatedAt")
      values (${classId}, ${WORKSPACE_ID}, ${evidenceId}, ${communicationId}, ${feeHash}, 'FLAGGED',
        'demo-seed', 'email-taxonomy-v1', 1,
        ${JSON.stringify({
          clean: false,
          signals: [
            {
              category: c.emailFlag.type,
              severity: c.emailFlag.severity,
              confidence: 0.91,
              excerpt: c.emailFlag.excerpt,
              rationale: c.emailFlag.rationale,
            },
          ],
        })}::jsonb,
        ${now}::timestamptz, ${now}::timestamptz)`;
    await sql`insert into "Flag"
      (id, "workspaceId", "sourceType", "sourceId", "communicationId", type, severity, status,
       evidence, "dedupeKey", "createdByType", "createdAt", "updatedAt")
      values (${cuid()}, ${WORKSPACE_ID}, 'EMAIL', ${threadId}, ${communicationId},
        ${c.emailFlag.type}, ${c.emailFlag.severity}, 'OPEN',
        ${JSON.stringify({
          excerpt: c.emailFlag.excerpt,
          rationale: c.emailFlag.rationale,
          confidence: 0.91,
          communicationId,
          threadId,
          evidenceItemId: evidenceId,
          contentSha256: feeHash,
        })}::jsonb,
        ${`email:${communicationId}:${c.emailFlag.type}`}, 'SYSTEM',
        ${daysAgo(1)}::timestamptz, ${now}::timestamptz)`;
  }

  created.push({ clientId, name: c.name, email: c.email });
}

// Advice / trade-instruction email (open EMAIL flag for Review Queue)
const adviceClient = created.find((c) => c.name === ADVICE_EMAIL.clientName);
if (adviceClient) {
  const occurredAt = daysAgo(2);
  const hash = sha256(`${ADVICE_EMAIL.subject}\n${ADVICE_EMAIL.body}`);
  const threadId = cuid();
  const evidenceId = cuid();
  const communicationId = cuid();
  const searchable = emailSearchable(ADVICE_EMAIL.subject, ADVICE_EMAIL.body);
  await sql`insert into "CommunicationThread"
    (id, "workspaceId", channel, "externalThreadId", subject, participants, "createdAt", "updatedAt")
    values (${threadId}, ${WORKSPACE_ID}, 'EMAIL_GMAIL', ${`demo-advice-${adviceClient.clientId}`},
      ${ADVICE_EMAIL.subject},
      ${JSON.stringify([{ email: adviceClient.email, role: "client" }])}::jsonb,
      ${now}::timestamptz, ${now}::timestamptz)`;
  await sql`insert into "EvidenceItem"
    (id, "workspaceId", "clientId", "sourceType", title, "occurredAt", "contentSha256",
     "searchableText", "classificationStatus", "createdAt", "updatedAt")
    values (${evidenceId}, ${WORKSPACE_ID}, ${adviceClient.clientId}, 'EMAIL', ${ADVICE_EMAIL.subject},
      ${occurredAt}::timestamptz, ${hash}, ${searchable}, 'COMPLETE',
      ${now}::timestamptz, ${now}::timestamptz)`;
  await sql`insert into "Communication"
    (id, "threadId", "evidenceItemId", direction, "sentAt", "fromAddress", "toAddresses",
     "ccAddresses", "bodyText", "internetMessageId", "createdAt", "updatedAt")
    values (${communicationId}, ${threadId}, ${evidenceId}, 'OUTBOUND', ${occurredAt}::timestamptz,
      'compliance@demo.complyvault.co', ${[adviceClient.email]}::text[], '{}'::text[],
      ${ADVICE_EMAIL.body}, ${`<demo-advice-${adviceClient.clientId}@example.com>`},
      ${now}::timestamptz, ${now}::timestamptz)`;
  await sql`insert into "ClientActivity"
    (id, "workspaceId", "clientId", type, "occurredAt", title, direction, counterparties,
     "evidenceItemId", "threadId", "contentSha256", "createdAt", "updatedAt")
    values (${cuid()}, ${WORKSPACE_ID}, ${adviceClient.clientId}, 'EMAIL_SENT', ${occurredAt}::timestamptz,
      ${ADVICE_EMAIL.subject}, 'OUTBOUND', ${[adviceClient.email]}::text[], ${evidenceId}, ${threadId},
      ${hash}, ${now}::timestamptz, ${now}::timestamptz)`;
  await sql`insert into "EvidenceClassification"
    (id, "workspaceId", "evidenceItemId", "communicationId", "contentHash", result, "modelId",
     "promptVersion", "signalCount", "rawResponse", "createdAt", "updatedAt")
    values (${cuid()}, ${WORKSPACE_ID}, ${evidenceId}, ${communicationId}, ${hash}, 'FLAGGED',
      'demo-seed', 'email-taxonomy-v1', 1,
      ${JSON.stringify({
        clean: false,
        signals: [
          {
            category: ADVICE_EMAIL.flag.type,
            severity: ADVICE_EMAIL.flag.severity,
            confidence: 0.94,
            excerpt: ADVICE_EMAIL.flag.excerpt,
            rationale: ADVICE_EMAIL.flag.rationale,
          },
        ],
      })}::jsonb,
      ${now}::timestamptz, ${now}::timestamptz)`;
  await sql`insert into "Flag"
    (id, "workspaceId", "sourceType", "sourceId", "communicationId", type, severity, status,
     evidence, "dedupeKey", "createdByType", "createdAt", "updatedAt")
    values (${cuid()}, ${WORKSPACE_ID}, 'EMAIL', ${threadId}, ${communicationId},
      ${ADVICE_EMAIL.flag.type}, ${ADVICE_EMAIL.flag.severity}, 'OPEN',
      ${JSON.stringify({
        excerpt: ADVICE_EMAIL.flag.excerpt,
        rationale: ADVICE_EMAIL.flag.rationale,
        confidence: 0.94,
        communicationId,
        threadId,
        evidenceItemId: evidenceId,
        contentSha256: hash,
      })}::jsonb,
      ${`email:${communicationId}:${ADVICE_EMAIL.flag.type}`}, 'SYSTEM',
      ${daysAgo(1)}::timestamptz, ${now}::timestamptz)`;
}

// Performance email
const perf = created.find((c) => c.name === "James Whitfield");
if (perf) {
  const subject = "Market outlook note";
  const body =
    "Quick note in writing: we cannot promise or guarantee investment performance. Past results do not ensure future returns. Happy to walk through scenarios on our next call.";
  const hash = sha256(`${subject}\n${body}`);
  const occurredAt = daysAgo(8);
  const threadId = cuid();
  const evidenceId = cuid();
  const communicationId = cuid();
  const searchable = emailSearchable(subject, body);
  await sql`insert into "CommunicationThread"
    (id, "workspaceId", channel, "externalThreadId", subject, participants, "createdAt", "updatedAt")
    values (${threadId}, ${WORKSPACE_ID}, 'EMAIL_GMAIL', ${`demo-perf-${perf.clientId}`}, ${subject},
      ${JSON.stringify([{ email: perf.email, role: "client" }])}::jsonb,
      ${now}::timestamptz, ${now}::timestamptz)`;
  await sql`insert into "EvidenceItem"
    (id, "workspaceId", "clientId", "sourceType", title, "occurredAt", "contentSha256",
     "searchableText", "classificationStatus", "createdAt", "updatedAt")
    values (${evidenceId}, ${WORKSPACE_ID}, ${perf.clientId}, 'EMAIL', ${subject},
      ${occurredAt}::timestamptz, ${hash}, ${searchable}, 'COMPLETE',
      ${now}::timestamptz, ${now}::timestamptz)`;
  await sql`insert into "Communication"
    (id, "threadId", "evidenceItemId", direction, "sentAt", "fromAddress", "toAddresses",
     "ccAddresses", "bodyText", "internetMessageId", "createdAt", "updatedAt")
    values (${communicationId}, ${threadId}, ${evidenceId}, 'OUTBOUND', ${occurredAt}::timestamptz,
      'compliance@demo.complyvault.co', ${[perf.email]}::text[], '{}'::text[], ${body},
      ${`<demo-perf-${perf.clientId}@example.com>`}, ${now}::timestamptz, ${now}::timestamptz)`;
  await sql`insert into "ClientActivity"
    (id, "workspaceId", "clientId", type, "occurredAt", title, direction, counterparties,
     "evidenceItemId", "threadId", "contentSha256", "createdAt", "updatedAt")
    values (${cuid()}, ${WORKSPACE_ID}, ${perf.clientId}, 'EMAIL_SENT', ${occurredAt}::timestamptz,
      ${subject}, 'OUTBOUND', ${[perf.email]}::text[], ${evidenceId}, ${threadId}, ${hash},
      ${now}::timestamptz, ${now}::timestamptz)`;
  await sql`insert into "Flag"
    (id, "workspaceId", "sourceType", "sourceId", "communicationId", type, severity, status,
     "resolutionType", "resolutionNote", "resolvedAt", "dedupeKey", "createdByType", "createdAt", "updatedAt")
    values (${cuid()}, ${WORKSPACE_ID}, 'EMAIL', ${threadId}, ${communicationId},
      'PERFORMANCE_CLAIM', 'WARN', 'CLOSED', 'DISMISSED_WITH_REASON',
      'Outbound disclaimer - no promise of returns', ${daysAgo(6)}::timestamptz,
      ${`email:${communicationId}:PERFORMANCE_CLAIM`}, 'SYSTEM',
      ${daysAgo(7)}::timestamptz, ${now}::timestamptz)`;
}

// ── CV-DM-01: held identities ──
const HELD = [
  {
    address: "jordan.lee.assistant@example.com",
    notes: "Assistant writing on behalf of a household — confirm before linking",
  },
  {
    address: "shared.family.trust@example.com",
    notes: "Shared mailbox; could be client or prospect — held",
  },
  {
    address: "unknown.sender.demo@example.com",
    notes: "Inbound address with no alias — triage queue",
  },
];
for (const h of HELD) {
  await sql`insert into "EmailTriageItem"
    (id, "workspaceId", address, status, notes, "createdAt", "updatedAt")
    values (${cuid()}, ${WORKSPACE_ID}, ${h.address}, 'PENDING', ${h.notes},
      ${daysAgo(2)}::timestamptz, ${now}::timestamptz)
    on conflict ("workspaceId", address) do update set
      status = 'PENDING', notes = excluded.notes, "updatedAt" = ${now}::timestamptz`;
}

const heldClientId = cuid();
await sql`insert into "Client"
  (id, "workspaceId", name, status, "lastContactAt", "createdAt", "updatedAt")
  values (${heldClientId}, ${WORKSPACE_ID}, 'Robert Chen', 'CLIENT', ${daysAgo(5)}::timestamptz,
    ${now}::timestamptz, ${now}::timestamptz)`;
const heldMeetingId = cuid();
const heldTranscript = JSON.stringify({
  segments: [
    {
      startTime: 10,
      endTime: 35,
      speaker: "Advisor",
      text: "We discussed beneficiary designation update with the household.",
    },
  ],
});
const heldExtraction = JSON.stringify({
  topics: ["beneficiary designation update"],
  recommendations: [],
  disclosures: [],
  decisions: [],
  followUps: [
    { text: "CCO to confirm client identity before linking", startTime: 35 },
  ],
});
await sql`insert into "Meeting"
  (id, "workspaceId", "clientName", "clientId", "clientMatchConfidence", "participantEmails",
   "meetingType", "meetingDate", status, "draftReadyAt", "finalizedAt", "timeToFinalize",
   "finalizeReason", "searchableText", transcript, extraction, "readyForCCO", "createdAt", "updatedAt")
  values (${heldMeetingId}, ${WORKSPACE_ID}, 'Robert Chen', null, null, '{}'::text[],
    'Annual Review', ${daysAgo(5)}::timestamptz, 'FINALIZED', ${daysAgo(4)}::timestamptz,
    ${daysAgo(3)}::timestamptz, 86400, 'COMPLETE_REVIEW',
    'robert chen beneficiary designation update held for confirmation demo',
    ${heldTranscript}::jsonb, ${heldExtraction}::jsonb, false,
    ${now}::timestamptz, ${now}::timestamptz)`;

// ── CV-DM-01 / CV-FC-01: parked ingest ──
await sql`delete from "ParkedIngest"
  where "workspaceId" = ${WORKSPACE_ID} and "externalRef" = 'demo-parked-zoom-recording-001'`;
await sql`insert into "ParkedIngest"
  (id, "workspaceId", source, "externalRef", payload, "occurredAt", status, "parkedAt",
   "createdAt", "updatedAt")
  values (${cuid()}, ${WORKSPACE_ID}, 'zoom', 'demo-parked-zoom-recording-001',
    ${JSON.stringify({
      demo: true,
      note: "Seeded parked ingest for fail-closed demonstration",
      meetingTopic: "Q2 review — posture gate demo",
    })}::jsonb,
    ${daysAgo(3)}::timestamptz, 'PARKED', ${daysAgo(3)}::timestamptz,
    ${now}::timestamptz, ${now}::timestamptz)`;
await sql`insert into "AuditEvent"
  (id, "workspaceId", "userId", action, "resourceType", "resourceId", metadata, timestamp)
  values (${cuid()}, ${WORKSPACE_ID}, 'system', 'INGEST_PARKED', 'workspace', ${WORKSPACE_ID},
    ${JSON.stringify({
      source: "zoom",
      externalRef: "demo-parked-zoom-recording-001",
      parked: true,
      note: "Ingest refused because no media posture decision exists. Replay from the parked recordings list after the CCO decides.",
      demoSeed: true,
    })}::jsonb,
    ${now}::timestamptz)`;

// ── CV-DM-01 / CV-AX-06: coverage manifest ──
const emailAgg = await sql`
  select min("occurredAt") as "from", max("occurredAt") as "to", count(*)::int as n
  from "EvidenceItem"
  where "workspaceId" = ${WORKSPACE_ID} and "sourceType" = 'EMAIL' and "deletedAt" is null`;
const meetingAgg = await sql`
  select min("meetingDate") as "from", max("meetingDate") as "to", count(*)::int as n
  from "Meeting"
  where "workspaceId" = ${WORKSPACE_ID}
    and status in ('DRAFT_READY','FINALIZED')
    and coalesce("searchableText",'') <> 'prior engagement archived demo reseed'`;
const sources = [
  {
    sourceType: "EMAIL",
    from: emailAgg[0]?.from?.toISOString?.() ?? emailAgg[0]?.from ?? "2025-04-01T00:00:00.000Z",
    to: emailAgg[0]?.to?.toISOString?.() ?? emailAgg[0]?.to ?? now,
    chunkCount: emailAgg[0]?.n ?? 0,
  },
  {
    sourceType: "MEETING",
    from: meetingAgg[0]?.from?.toISOString?.() ?? meetingAgg[0]?.from ?? "2025-04-01T00:00:00.000Z",
    to: meetingAgg[0]?.to?.toISOString?.() ?? meetingAgg[0]?.to ?? now,
    chunkCount: meetingAgg[0]?.n ?? 0,
  },
];
const gapPeriods = [
  {
    sourceType: "EMAIL",
    from: "2024-01-01",
    to: "2024-03-31",
    reason: "Mailbox not connected for Q1 2024",
  },
  {
    sourceType: "MEETING",
    from: "2023-01-01",
    to: "2023-12-31",
    reason: "Meeting capture not enabled in 2023 — out-of-range for Ask",
  },
];
const unindexedSources = [
  { name: "SMS", reason: "SMS channel not connected — demo honest miss" },
  {
    name: "WhatsApp",
    reason: "Off-channel upload not indexed for Ask — demo honest miss",
  },
  {
    name: "Teams chat",
    reason: "Teams chat not in demo index — demo honest miss",
  },
];
await sql`insert into "IndexCoverageManifest"
  (id, "workspaceId", sources, "gapPeriods", "unindexedSources", "lastIndexedAt", "createdAt", "updatedAt")
  values (${cuid()}, ${WORKSPACE_ID}, ${JSON.stringify(sources)}::jsonb,
    ${JSON.stringify(gapPeriods)}::jsonb, ${JSON.stringify(unindexedSources)}::jsonb,
    ${now}::timestamptz, ${now}::timestamptz, ${now}::timestamptz)
  on conflict ("workspaceId") do update set
    sources = excluded.sources,
    "gapPeriods" = excluded."gapPeriods",
    "unindexedSources" = excluded."unindexedSources",
    "lastIndexedAt" = excluded."lastIndexedAt",
    "deletedAt" = null,
    "updatedAt" = ${now}::timestamptz`;

await sql`update "CandidateResponsePack" set "deletedAt" = ${now}::timestamptz
  where "workspaceId" = ${WORKSPACE_ID} and "deletedAt" is null`;

const summary = await sql`
  select
    (select name from "Workspace" where id = ${WORKSPACE_ID}) as firm,
    (select "crdNumber" from "FirmProfile" where "workspaceId" = ${WORKSPACE_ID}) as crd,
    (select "ccoName" from "FirmProfile" where "workspaceId" = ${WORKSPACE_ID}) as cco,
    (select count(*)::int from "Client" where "workspaceId" = ${WORKSPACE_ID} and "deletedAt" is null) as clients,
    (select count(*)::int from "EvidenceItem" where "workspaceId" = ${WORKSPACE_ID} and "deletedAt" is null) as evidence,
    (select count(*)::int from "Flag" where "workspaceId" = ${WORKSPACE_ID}
      and status in ('OPEN','IN_REMEDIATION','PENDING_VERIFICATION')) as "openFlags",
    (select count(*)::int from "EmailTriageItem" where "workspaceId" = ${WORKSPACE_ID} and status = 'PENDING') as held,
    (select count(*)::int from "ParkedIngest" where "workspaceId" = ${WORKSPACE_ID} and status = 'PARKED' and "deletedAt" is null) as parked
`;
console.log("Demo seed complete (CV-DM-01).", summary[0]);
console.log("\n── Rehearsed Ask ──");
console.log('  1. "Show me every email where a client mentioned fees since April"');
console.log('  2. "Has any advisor promised performance in writing?"');
console.log('  3. "When did we last hear from Margaret Ellison and about what?"');
console.log("\n── Honest miss ──");
console.log('  SMS: "Show me SMS messages about fees"');
console.log('  Out-of-range: "What fee emails do we have from 2023-02-15?"');
console.log('  No evidence: "Any evidence of private jet gifts to clients?"');
console.log("\n── Surfaces ── /needs-attention  /fail-closed  /partner/portfolio");
console.log(
  "\nN1 corpus only — do not claim these rows are mailbox disclosure (N2)."
);
console.log("Next: npx tsx scripts/demo-embed-backfill.ts " + WORKSPACE_ID);
