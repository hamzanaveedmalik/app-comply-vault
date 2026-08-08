/**
 * Patch live demo workspace: attach OPEN EMAIL flags to seeded fee/advice threads
 * so Review Queue → Email signals lights up without a full reseed.
 *
 * Usage:
 *   DATABASE_URL=... node scripts/patch-demo-email-flags.mjs <workspaceId> --confirm
 */
import crypto from "node:crypto";
import { neon } from "@neondatabase/serverless";

const WORKSPACE_ID = process.argv[2];
const DATABASE_URL = process.env.DATABASE_URL;
if (!WORKSPACE_ID || process.argv[3] !== "--confirm" || !DATABASE_URL) {
  console.error(
    "Usage: DATABASE_URL=... node scripts/patch-demo-email-flags.mjs <workspaceId> --confirm"
  );
  process.exit(1);
}

process.env.NODE_TLS_REJECT_UNAUTHORIZED ??= "0";
const sql = neon(DATABASE_URL);

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

const margaret = await sql`
  select c.id as "clientId", c.name, e.id as "evidenceId", e."contentSha256",
         e.title, comm.id as "communicationId", comm."threadId", comm."bodyText"
  from "Client" c
  join "EvidenceItem" e on e."clientId" = c.id and e."deletedAt" is null
  join "Communication" comm on comm."evidenceItemId" = e.id and comm."deletedAt" is null
  where c."workspaceId" = ${WORKSPACE_ID}
    and c."deletedAt" is null
    and c.name = 'Margaret Ellison'
    and e.title ilike 'Fee schedule question%'
  limit 1
`;

const james = await sql`
  select id as "clientId", name from "Client"
  where "workspaceId" = ${WORKSPACE_ID} and "deletedAt" is null and name = 'James Whitfield'
  limit 1
`;

let created = 0;

if (margaret[0]) {
  const m = margaret[0];
  const existing = await sql`
    select id from "Flag"
    where "workspaceId" = ${WORKSPACE_ID}
      and "communicationId" = ${m.communicationId}
      and type = 'FEE_DISPUTE'
      and status in ('OPEN','IN_REMEDIATION','PENDING_VERIFICATION')
    limit 1
  `;
  if (!existing[0]) {
    const excerpt =
      "I am unhappy about what we charge. The 1.25% advisory fee feels high";
    const rationale =
      "Client expressed dissatisfaction with advisory fees and asked to revisit the fee schedule.";
    await sql`insert into "EvidenceClassification"
      (id, "workspaceId", "evidenceItemId", "communicationId", "contentHash", result, "modelId",
       "promptVersion", "signalCount", "rawResponse", "createdAt", "updatedAt")
      values (${cuid()}, ${WORKSPACE_ID}, ${m.evidenceId}, ${m.communicationId}, ${m.contentSha256},
        'FLAGGED', 'demo-seed', 'email-taxonomy-v1', 1,
        ${JSON.stringify({
          clean: false,
          signals: [
            {
              category: "FEE_DISPUTE",
              severity: "WARN",
              confidence: 0.91,
              excerpt,
              rationale,
            },
          ],
        })}::jsonb,
        ${now}::timestamptz, ${now}::timestamptz)
      on conflict ("workspaceId", "evidenceItemId", "contentHash") do nothing`;
    await sql`insert into "Flag"
      (id, "workspaceId", "sourceType", "sourceId", "communicationId", type, severity, status,
       evidence, "dedupeKey", "createdByType", "createdAt", "updatedAt")
      values (${cuid()}, ${WORKSPACE_ID}, 'EMAIL', ${m.threadId}, ${m.communicationId},
        'FEE_DISPUTE', 'WARN', 'OPEN',
        ${JSON.stringify({
          excerpt,
          rationale,
          confidence: 0.91,
          communicationId: m.communicationId,
          threadId: m.threadId,
          evidenceItemId: m.evidenceId,
          contentSha256: m.contentSha256,
        })}::jsonb,
        ${`email:${m.communicationId}:FEE_DISPUTE`}, 'SYSTEM',
        ${daysAgo(1)}::timestamptz, ${now}::timestamptz)`;
    created += 1;
    console.log("OPEN FEE_DISPUTE → Margaret Ellison fee thread");
  } else {
    console.log("Margaret FEE_DISPUTE already open");
  }
} else {
  console.log("Margaret fee thread not found");
}

if (james[0]) {
  const existingAdvice = await sql`
    select e.id from "EvidenceItem" e
    where e."workspaceId" = ${WORKSPACE_ID}
      and e."deletedAt" is null
      and e.title = 'Pension consolidation recommendation'
    limit 1
  `;
  if (!existingAdvice[0]) {
    const subject = "Pension consolidation recommendation";
    const body =
      "Hey James Whitfield - we are advising you to move your pension funds into our discretionary managed account this week. Please confirm so we can place the trade.";
    const excerpt =
      "advising you to move your pension funds into our discretionary managed account this week. Please confirm so we can place the trade.";
    const rationale =
      "Outbound message contains an investment recommendation and a request to confirm a trade instruction by email.";
    const hash = sha256(`${subject}\n${body}`);
    const occurredAt = daysAgo(2);
    const threadId = cuid();
    const evidenceId = cuid();
    const communicationId = cuid();
    const searchable = emailSearchable(subject, body);
    const clientId = james[0].clientId;

    await sql`insert into "CommunicationThread"
      (id, "workspaceId", channel, "externalThreadId", subject, participants, "createdAt", "updatedAt")
      values (${threadId}, ${WORKSPACE_ID}, 'EMAIL_GMAIL', ${`demo-advice-${clientId}`}, ${subject},
        ${JSON.stringify([{ email: "james.whitfield@example.com", role: "client" }])}::jsonb,
        ${now}::timestamptz, ${now}::timestamptz)`;
    await sql`insert into "EvidenceItem"
      (id, "workspaceId", "clientId", "sourceType", title, "occurredAt", "contentSha256",
       "searchableText", "classificationStatus", "createdAt", "updatedAt")
      values (${evidenceId}, ${WORKSPACE_ID}, ${clientId}, 'EMAIL', ${subject},
        ${occurredAt}::timestamptz, ${hash}, ${searchable}, 'COMPLETE',
        ${now}::timestamptz, ${now}::timestamptz)`;
    await sql`insert into "Communication"
      (id, "threadId", "evidenceItemId", direction, "sentAt", "fromAddress", "toAddresses",
       "ccAddresses", "bodyText", "internetMessageId", "createdAt", "updatedAt")
      values (${communicationId}, ${threadId}, ${evidenceId}, 'OUTBOUND', ${occurredAt}::timestamptz,
        'compliance@complyvault.co', ${["james.whitfield@example.com"]}::text[], '{}'::text[],
        ${body}, ${`<demo-advice-${clientId}@example.com>`},
        ${now}::timestamptz, ${now}::timestamptz)`;
    await sql`insert into "ClientActivity"
      (id, "workspaceId", "clientId", type, "occurredAt", title, direction, counterparties,
       "evidenceItemId", "threadId", "contentSha256", "createdAt", "updatedAt")
      values (${cuid()}, ${WORKSPACE_ID}, ${clientId}, 'EMAIL_SENT', ${occurredAt}::timestamptz,
        ${subject}, 'OUTBOUND', ${["james.whitfield@example.com"]}::text[], ${evidenceId}, ${threadId},
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
              category: "TRADE_INSTRUCTION",
              severity: "CRITICAL",
              confidence: 0.94,
              excerpt,
              rationale,
            },
          ],
        })}::jsonb,
        ${now}::timestamptz, ${now}::timestamptz)`;
    await sql`insert into "Flag"
      (id, "workspaceId", "sourceType", "sourceId", "communicationId", type, severity, status,
       evidence, "dedupeKey", "createdByType", "createdAt", "updatedAt")
      values (${cuid()}, ${WORKSPACE_ID}, 'EMAIL', ${threadId}, ${communicationId},
        'TRADE_INSTRUCTION', 'CRITICAL', 'OPEN',
        ${JSON.stringify({
          excerpt,
          rationale,
          confidence: 0.94,
          communicationId,
          threadId,
          evidenceItemId: evidenceId,
          contentSha256: hash,
        })}::jsonb,
        ${`email:${communicationId}:TRADE_INSTRUCTION`}, 'SYSTEM',
        ${daysAgo(1)}::timestamptz, ${now}::timestamptz)`;
    created += 1;
    console.log("OPEN TRADE_INSTRUCTION → James Whitfield advice thread");
  } else {
    console.log("Advice thread already present");
  }
} else {
  console.log("James Whitfield client not found");
}

const openEmail = await sql`
  select f.type, f.severity, f.status, e.title
  from "Flag" f
  left join "Communication" c on c.id = f."communicationId"
  left join "EvidenceItem" e on e.id = c."evidenceItemId"
  where f."workspaceId" = ${WORKSPACE_ID}
    and f."sourceType" = 'EMAIL'
    and f.status in ('OPEN','IN_REMEDIATION','PENDING_VERIFICATION')
  order by f."createdAt" desc
`;

console.log(`Patch complete. Created ${created} new open email flag(s).`);
console.log("Open EMAIL flags:", openEmail);
console.log(
  "\nReview Queue needs EMAIL_INTELLIGENCE_ENABLED / NEXT_PUBLIC_EMAIL_INTELLIGENCE=true on the deployed env."
);
