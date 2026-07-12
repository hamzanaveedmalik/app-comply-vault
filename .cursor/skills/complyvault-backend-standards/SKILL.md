---
name: complyvault-backend-standards
description: Backend engineering standards for ComplyVault — Prisma schema changes, server modules, API route handlers, background jobs, audit logging, multi-tenancy. Use when writing or modifying anything in src/server, src/app/api, prisma/schema.prisma, or queue workers.
---

# ComplyVault Backend Standards

## Current architecture (match it)

- **API**: Next.js App Router route handlers in `src/app/api/*/route.ts` that delegate immediately to domain modules in `src/server/<domain>/`. No business logic in route handlers.
- Project rules prefer tRPC; the codebase has not adopted it. Do not introduce tRPC piecemeal — follow the existing route-handler → server-module pattern unless the user explicitly approves a tRPC migration.
- **Auth**: NextAuth v5 (`src/server/auth`). Every sensitive route validates the session and workspace membership. Never add a new auth library.
- **DB**: Prisma 6 + Postgres, client at `src/server/db.ts`. Jobs: BullMQ + ioredis; scheduled work via Upstash QStash (`src/server/qstash.ts`).
- **Storage**: S3 via `src/server/storage.ts` / `storage-utils.ts`; hashing helpers in `src/server/hash.ts`.

## Multi-tenancy (non-negotiable)

Tenant scope is `workspaceId` (the backlog calls it `firmId` — same concept). Every query on tenant-scoped models filters by it, derived from the session, never from client input. Cross-tenant access must be impossible by construction, and a test must prove it.

## Prisma schema changes

1. All models: `id`, `createdAt`, `updatedAt`, `deletedAt` (soft delete). Add indexes for the query patterns you're writing.
2. After editing `schema.prisma`, surface to the user: `npx prisma migrate dev --name <descriptive-name>` then `npx prisma generate`.
3. Never expose Prisma models to the client — map to DTOs (shared types in `src/lib/types.ts`).
4. Multi-model writes use `prisma.$transaction`.
5. Raw SQL only when the ORM can't express it, with a `// RAW SQL: reason` comment (pgvector similarity is the expected case).

## Audit logging (every compliance mutation)

Use the `AuditEvent` model (`workspaceId`, `userId`, `action`, `resourceType`, `resourceId`, `metadata`). Append-only — never update or delete audit rows. When implementing the hash-chained `AuditLog` (story CV-0-04): single `writeAudit()` helper is the only write path; `rowHash = sha256(prevHash + canonical(payload))` chained per workspace; write it inside the same transaction as the mutation.

Log entity IDs, never client names or financial data. This applies to `console.*` and thrown error messages too.

## Validation & types

- Zod schema on every input boundary (route handler bodies, job payloads, webhook payloads). Parse, don't trust.
- Explicit return types on all exported functions. No `any`; no `as` without `// CAST: reason`.
- Mutation-style endpoints return `{ success: boolean, data?: T, error?: string }`. Error strings must be PII-free.

## Background jobs

- Anything slow (backfill, sync, classification, export) goes on the queue — route handlers only enqueue and return a job ID.
- Jobs are resumable: persist a cursor (`IngestJob.cursor`), checkpoint per page, and make handlers idempotent (dedupe keys like `internetMessageId`, upsert semantics).
- Record counts and errors in `IngestJob.stats`; failures land in a dead-letter state, never silently dropped.

## Compliance invariants

- Soft delete only (`deletedAt`) for anything that is or references evidence.
- Capture is never filtered by content — scope filters (mailbox/folder/date) are the only ingestion filters.
- AI classification outputs are triage signals; `ReviewCase`/`Finding` creation is the only path that makes a compliance record.
- Raw content is immutable once stored; verify `contentSha256` on read paths that re-serve originals.
