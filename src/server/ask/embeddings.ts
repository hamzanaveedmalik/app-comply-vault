/**
 * Evidence embeddings — OpenAI text-embedding-3-small + pgvector upsert.
 * Embed redacted text only. Payload to QStash is ids only.
 */

import crypto from "node:crypto";
import OpenAI from "openai";
import { Prisma } from "../../../generated/prisma";
import { db } from "~/server/db";
import { env } from "~/env";
import { redactForLlm } from "~/server/classification/redaction-guard";

export const EMBEDDING_MODEL = "text-embedding-3-small";
export const EMBEDDING_MODEL_VERSION = "v1";
export const EMBEDDING_DIMENSIONS = 1536;

function getOpenAI(): OpenAI | null {
  if (!env.OPENAI_API_KEY) return null;
  return new OpenAI({ apiKey: env.OPENAI_API_KEY });
}

export function vectorToSqlLiteral(values: number[]): string {
  return `[${values.join(",")}]`;
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const client = getOpenAI();
  if (!client) {
    throw new Error("OPENAI_API_KEY is not configured for embeddings");
  }
  const res = await client.embeddings.create({
    model: EMBEDDING_MODEL,
    input: texts.map((t) => t.slice(0, 8000)),
  });
  return res.data
    .sort((a, b) => a.index - b.index)
    .map((d) => d.embedding);
}

export async function upsertEvidenceEmbedding(args: {
  workspaceId: string;
  sourceType: "EMAIL" | "MEETING";
  sourceId: string;
  chunkKey: string;
  text: string;
  embedding: number[];
}): Promise<void> {
  if (args.embedding.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(
      `Expected ${EMBEDDING_DIMENSIONS}-dim embedding, got ${args.embedding.length}`
    );
  }
  const chunkTextHash = crypto
    .createHash("sha256")
    .update(args.text)
    .digest("hex");
  const id = crypto.randomUUID().replace(/-/g, "").slice(0, 24);
  const literal = vectorToSqlLiteral(args.embedding);

  // RAW SQL: Prisma cannot write Unsupported("vector") columns.
  await db.$executeRaw`
    INSERT INTO "EvidenceEmbedding" (
      "id", "workspaceId", "sourceType", "sourceId", "chunkKey",
      "chunkTextHash", "embedding", "model", "modelVersion",
      "createdAt", "updatedAt"
    ) VALUES (
      ${id},
      ${args.workspaceId},
      CAST(${args.sourceType} AS "EvidenceSourceType"),
      ${args.sourceId},
      ${args.chunkKey},
      ${chunkTextHash},
      ${Prisma.raw(`'${literal}'::vector`)},
      ${EMBEDDING_MODEL},
      ${EMBEDDING_MODEL_VERSION},
      NOW(),
      NOW()
    )
    ON CONFLICT ("workspaceId", "chunkKey", "model")
    DO UPDATE SET
      "chunkTextHash" = EXCLUDED."chunkTextHash",
      "embedding" = EXCLUDED."embedding",
      "modelVersion" = EXCLUDED."modelVersion",
      "sourceId" = EXCLUDED."sourceId",
      "sourceType" = EXCLUDED."sourceType",
      "updatedAt" = NOW(),
      "deletedAt" = NULL
  `;
}

/**
 * Embed one email evidence item (redacted body). Safe after classification.
 */
export async function embedEmailEvidence(args: {
  workspaceId: string;
  evidenceItemId: string;
}): Promise<{ status: "embedded" | "skipped"; reason?: string }> {
  const item = await db.evidenceItem.findFirst({
    where: {
      id: args.evidenceItemId,
      workspaceId: args.workspaceId,
      deletedAt: null,
      sourceType: "EMAIL",
    },
    include: { communication: true },
  });
  if (!item?.communication) {
    return { status: "skipped", reason: "not_email" };
  }

  const redacted = redactForLlm({
    bodyText: item.communication.bodyText,
    fromAddress: item.communication.fromAddress,
    toAddresses: item.communication.toAddresses,
  });
  const text = [item.title, redacted.text].filter(Boolean).join("\n").trim();
  if (!text) return { status: "skipped", reason: "empty" };

  const [embedding] = await embedTexts([text]);
  if (!embedding) return { status: "skipped", reason: "embed_failed" };

  await upsertEvidenceEmbedding({
    workspaceId: args.workspaceId,
    sourceType: "EMAIL",
    sourceId: item.id,
    chunkKey: item.id,
    text,
    embedding,
  });
  return { status: "embedded" };
}

/**
 * Embed meeting transcript segments (redacted). One row per segment.
 */
export async function embedMeetingEvidence(args: {
  workspaceId: string;
  meetingId: string;
}): Promise<{ status: "embedded" | "skipped"; chunks: number; reason?: string }> {
  const meeting = await db.meeting.findFirst({
    where: { id: args.meetingId, workspaceId: args.workspaceId },
    select: { id: true, transcript: true, clientName: true },
  });
  if (!meeting) return { status: "skipped", chunks: 0, reason: "not_found" };

  const transcript = meeting.transcript as {
    segments?: Array<{ text?: string }>;
  } | null;
  const segments = transcript?.segments ?? [];
  const texts: string[] = [];
  const keys: string[] = [];
  for (let i = 0; i < segments.length; i++) {
    const raw = segments[i]?.text?.trim();
    if (!raw) continue;
    const redacted = redactForLlm({
      bodyText: raw,
      fromAddress: "",
      toAddresses: [],
    });
    texts.push(redacted.text);
    keys.push(`${meeting.id}:${i}`);
  }
  if (texts.length === 0) {
    return { status: "skipped", chunks: 0, reason: "no_segments" };
  }

  const embeddings = await embedTexts(texts);
  for (let i = 0; i < texts.length; i++) {
    const embedding = embeddings[i];
    const text = texts[i];
    const chunkKey = keys[i];
    if (!embedding || !text || !chunkKey) continue;
    await upsertEvidenceEmbedding({
      workspaceId: args.workspaceId,
      sourceType: "MEETING",
      sourceId: meeting.id,
      chunkKey,
      text,
      embedding,
    });
  }
  return { status: "embedded", chunks: texts.length };
}

export type SemanticHit = {
  sourceType: "EMAIL" | "MEETING";
  sourceId: string;
  chunkKey: string;
  cosineSimilarity: number;
  model: string;
  modelVersion: string;
};

/**
 * Workspace-scoped cosine search. Filter applied in SQL before ordering.
 */
export async function searchSimilarChunks(args: {
  workspaceId: string;
  queryEmbedding: number[];
  limit?: number;
  minCosine?: number;
}): Promise<SemanticHit[]> {
  const limit = args.limit ?? 20;
  const minCosine = args.minCosine ?? 0.25;
  const literal = vectorToSqlLiteral(args.queryEmbedding);

  // RAW SQL: cosine distance operator; workspace filter before ORDER BY.
  const rows = await db.$queryRaw<
    Array<{
      sourceType: "EMAIL" | "MEETING";
      sourceId: string;
      chunkKey: string;
      cosineSimilarity: number;
      model: string;
      modelVersion: string;
    }>
  >`
    SELECT
      "sourceType",
      "sourceId",
      "chunkKey",
      (1 - ("embedding" <=> ${Prisma.raw(`'${literal}'::vector`)})) AS "cosineSimilarity",
      "model",
      "modelVersion"
    FROM "EvidenceEmbedding"
    WHERE "workspaceId" = ${args.workspaceId}
      AND "deletedAt" IS NULL
    ORDER BY "embedding" <=> ${Prisma.raw(`'${literal}'::vector`)}
    LIMIT ${limit}
  `;

  return rows.filter((r) => r.cosineSimilarity >= minCosine);
}

export type EmbeddingBackfillStats = {
  processed: number;
  embedded: number;
  skipped: number;
  cursor: string | null;
  done: boolean;
};

/**
 * Resumable email embedding backfill by EvidenceItem id cursor.
 */
export async function backfillEmailEmbeddings(args: {
  workspaceId?: string;
  cursor?: string | null;
  batchSize?: number;
}): Promise<EmbeddingBackfillStats> {
  const batchSize = args.batchSize ?? 20;
  const items = await db.evidenceItem.findMany({
    where: {
      ...(args.workspaceId ? { workspaceId: args.workspaceId } : {}),
      ...(args.cursor ? { id: { gt: args.cursor } } : {}),
      sourceType: "EMAIL",
      deletedAt: null,
    },
    orderBy: { id: "asc" },
    take: batchSize,
    select: { id: true, workspaceId: true },
  });

  const stats: EmbeddingBackfillStats = {
    processed: 0,
    embedded: 0,
    skipped: 0,
    cursor: null,
    done: items.length < batchSize,
  };

  for (const item of items) {
    stats.processed += 1;
    stats.cursor = item.id;
    try {
      const result = await embedEmailEvidence({
        workspaceId: item.workspaceId,
        evidenceItemId: item.id,
      });
      if (result.status === "embedded") stats.embedded += 1;
      else stats.skipped += 1;
    } catch {
      stats.skipped += 1;
    }
  }

  return stats;
}
