---
name: complyvault-export-pipeline
description: Standards for ComplyVault export generation — audit packs, ExamPacks, thread exports, PDF/ZIP bundles, chain-of-custody manifests. Use when implementing stories CV-A-07, CV-B-08, CV-D-01..07, or any code in src/server/export.
---

# ComplyVault Export Pipeline

Exports are what an examiner actually touches. Determinism, completeness and custody beat speed and prettiness.

## Location & shape

- All export code lives in `src/server/export/`. Existing tools: `pdfkit` for PDFs, `archiver` for ZIPs, S3 presigned URLs for delivery.
- Exports run as queued jobs (BullMQ) — route handlers enqueue and return a job ID; the UI polls or is notified. Never generate synchronously in a request.
- Pull all data via Prisma server-side. Never accept client-supplied content for a regulatory document — the client sends IDs, the server resolves everything.

## Determinism (hard requirement)

Same input state → byte-identical manifest. That means:

- Sort every collection explicitly (by `occurredAt` then `id`) — never rely on query order.
- No `new Date()` inside content generation; the export timestamp is captured once, stored on the export record, and injected.
- Canonical JSON serialisation (sorted keys) before hashing manifests.
- Store the result in `exportManifestSha256`; a re-run comparison is the regression test.

## Chain-of-custody manifest

Every bundle includes a manifest listing, per item: source type, source system ID, `occurredAt`/`ingestedAt`, participants, owner, reviewer + sign-off state, and `contentSha256`. Verify each file's hash against its `EvidenceItem` record while writing the bundle — a mismatch aborts the export and raises an integrity alert; never export silently-corrupted content.

## Validation gate before release

Before returning a download URL, validate the generated output has all required SEC fields (dates ISO 8601, participant names and roles, firm CRD, normalized topics via `src/lib/topics.ts`, document version + generation timestamp). Fail closed: a pack missing required fields is a failed job, not a degraded success.

## Sign-off gating (ExamPack)

- Export is blocked until every `ExamRequest` section has required sign-offs (CV-D-05). Admin override requires a logged reason and writes an OVERRIDE audit event — make the override conspicuous in the manifest itself.
- AI draft summaries (`aiSummary`) may only appear in an export after sign-off, and are labelled as reviewer-approved summaries.

## Fidelity rules

- Preserve all original metadata — timestamps, participant names, topics — exactly as stored. No reformatting that loses precision (keep timezone offsets).
- Email exports include native EML alongside PDF rendering; message imports link back to the original source file hash.
- Every export writes EXPORT audit events (one per included item, plus one for the bundle). Deliver via presigned URL or buffer — never expose file paths.
