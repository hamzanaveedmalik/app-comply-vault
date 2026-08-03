/**
 * Demo-scope embedding backfill via Neon HTTP + OpenAI.
 * Use when Prisma TCP/TLS fails under corp MitM (same reason as seed-demo-neon.mjs).
 *
 * Usage:
 *   DATABASE_URL=... OPENAI_API_KEY=... node scripts/demo-embed-backfill-neon.mjs <workspaceId>
 */
import crypto from "node:crypto";
import { neon } from "@neondatabase/serverless";

const WORKSPACE_ID = process.argv[2];
const DATABASE_URL = process.env.DATABASE_URL;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const MODEL = "text-embedding-3-small";
const MODEL_VERSION = "v1";

if (!WORKSPACE_ID || !DATABASE_URL || !OPENAI_API_KEY) {
  console.error(
    "Usage: DATABASE_URL=... OPENAI_API_KEY=... node scripts/demo-embed-backfill-neon.mjs <workspaceId>"
  );
  process.exit(1);
}

process.env.NODE_TLS_REJECT_UNAUTHORIZED ??= "0";

const sql = neon(DATABASE_URL);

function cuid() {
  return "c" + crypto.randomBytes(12).toString("hex");
}

function sha256(text) {
  return crypto.createHash("sha256").update(text, "utf8").digest("hex");
}

function vectorLiteral(values) {
  return `[${values.join(",")}]`;
}

async function embedTexts(texts) {
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      input: texts.map((t) => t.slice(0, 8000)),
    }),
  });
  if (!res.ok) {
    throw new Error(`OpenAI embeddings ${res.status}: ${await res.text()}`);
  }
  const json = await res.json();
  return json.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
}

async function upsertEmbedding({
  sourceType,
  sourceId,
  chunkKey,
  text,
  embedding,
}) {
  const id = cuid();
  const hash = sha256(text);
  const lit = vectorLiteral(embedding);
  // Vector literal cannot be a bound param; values above are script-controlled.
  await sql.query(
    `INSERT INTO "EvidenceEmbedding" (
      "id", "workspaceId", "sourceType", "sourceId", "chunkKey",
      "chunkTextHash", "embedding", "model", "modelVersion",
      "createdAt", "updatedAt"
    ) VALUES (
      $1, $2, $3::"EvidenceSourceType", $4, $5, $6, '${lit}'::vector, $7, $8, NOW(), NOW()
    )
    ON CONFLICT ("workspaceId", "chunkKey", "model")
    DO UPDATE SET
      "chunkTextHash" = EXCLUDED."chunkTextHash",
      "embedding" = EXCLUDED."embedding",
      "modelVersion" = EXCLUDED."modelVersion",
      "sourceId" = EXCLUDED."sourceId",
      "sourceType" = EXCLUDED."sourceType",
      "updatedAt" = NOW(),
      "deletedAt" = NULL`,
    [id, WORKSPACE_ID, sourceType, sourceId, chunkKey, hash, MODEL, MODEL_VERSION]
  );
}

const ws = await sql`select id, name from "Workspace" where id = ${WORKSPACE_ID}`;
if (!ws[0]) {
  console.error("Workspace not found");
  process.exit(1);
}
console.log(`Neon HTTP embed backfill for ${ws[0].name} (${WORKSPACE_ID})`);

const emails = await sql`
  select e.id, e.title, c."bodyText"
  from "EvidenceItem" e
  join "Communication" c on c."evidenceItemId" = e.id
  where e."workspaceId" = ${WORKSPACE_ID}
    and e."sourceType" = 'EMAIL'
    and e."deletedAt" is null
    and c."deletedAt" is null`;

const meetings = await sql`
  select id, "searchableText", transcript
  from "Meeting"
  where "workspaceId" = ${WORKSPACE_ID}
    and status in ('DRAFT_READY', 'FINALIZED')
    and coalesce("searchableText", '') <> 'prior engagement archived demo reseed'`;

let emailEmbedded = 0;
for (const email of emails) {
  const text = [email.title, email.bodyText].filter(Boolean).join("\n").trim();
  if (!text) continue;
  const [embedding] = await embedTexts([text]);
  await upsertEmbedding({
    sourceType: "EMAIL",
    sourceId: email.id,
    chunkKey: email.id,
    text,
    embedding,
  });
  emailEmbedded += 1;
  console.log(`  email embedded ${email.id}`);
}

let meetingEmbedded = 0;
for (const meeting of meetings) {
  const segments = Array.isArray(meeting.transcript?.segments)
    ? meeting.transcript.segments
    : [];
  const chunks =
    segments.length > 0
      ? segments.map((s, i) => ({
          chunkKey: `${meeting.id}:${i}`,
          text: String(s.text ?? "").trim(),
        }))
      : [
          {
            chunkKey: `${meeting.id}:0`,
            text: String(meeting.searchableText ?? "").trim(),
          },
        ];
  const usable = chunks.filter((c) => c.text.length > 0);
  if (usable.length === 0) continue;
  const embeddings = await embedTexts(usable.map((c) => c.text));
  for (let i = 0; i < usable.length; i++) {
    await upsertEmbedding({
      sourceType: "MEETING",
      sourceId: meeting.id,
      chunkKey: usable[i].chunkKey,
      text: usable[i].text,
      embedding: embeddings[i],
    });
  }
  meetingEmbedded += 1;
  console.log(`  meeting embedded ${meeting.id} (${usable.length} chunks)`);
}

const count = await sql`
  select count(*)::int as n from "EvidenceEmbedding"
  where "workspaceId" = ${WORKSPACE_ID} and "deletedAt" is null`;
console.log(
  `Done. Embedded ${emailEmbedded} emails, ${meetingEmbedded} meetings. Total rows: ${count[0].n}`
);
