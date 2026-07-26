# Backlog: Phase 1 — Seal and Publish (v1.1, patched)

**Source PRD:** `docs/prd-trust-coverage-distribution.md` v2.0  
**Epic:** EPIC-TR (Trust Layer)  
**Supersedes:** `backlog-phase1-trust.md` v1.0  
**Window:** Weeks 1 to 7  
**Status:** ✅ Phase 1 product/code complete (2026-07-26) — remaining: CV-TR-01a deploy validation, sealed-bucket ops; CV-TR-11 optional/deferred

**Patch summary.** Added CV-TR-02a (deterministic bytes, fail-closed gate), CV-TR-04a and CV-TR-06a (existing-tenant migrations), CV-TR-18 (external deposit custody), CV-TR-19 (watermark exclusion). Rewrote CV-TR-01 dual-write as a content-addressed idempotent protocol. Removed coverage AC from CV-TR-17. Corrected cover-page copy, retention default conflict, timezone arithmetic, role names, discard scope, and the CV-WEB-02 integration inventory. Fixed `postureSetById` / `postureSetAt`.

**Sequencing fix (post-review).** CV-TR-19 and CV-TR-18 gate or ship with CV-TR-01 (not after). Seal timestamp is captured once at protocol start and injected into pack bytes.

**Role naming.** All stories use the code role `OWNER_CCO`. `COMPLIANCE_MANAGER` cannot set media posture, finalise, or supersede.

---

## CV-TR-02a — Deterministic pack bytes ✅ done (2026-07-26)

**Story.** As the system, I must produce byte-identical audit packs for the same record on every export, because a hash of nondeterministic bytes is a false integrity claim rather than a weak one.

**Blocks:** CV-TR-01. No seal may land until this passes.

**Done.** `src/server/export/deterministic.ts`, payload/ZIP/PDF timestamp normalisation, CI tests under UTC and Pacific/Auckland.

---

## CV-TR-04 / CV-TR-04a — Fiscal-year retention ✅ done (2026-07-26)

Schema + API + no-shortening rule. Migration sets existing workspaces to
`max(current, 6)` with December FYE. One-time OWNER_CCO notice
(`retentionAnchoringNoticePending`) surfaces in the app shell until dismissed;
dismissal is audited.

---

## CV-TR-06 / CV-TR-06a — Media posture forced decision ✅ done (2026-07-26)

Gate in `src/server/retention/media-posture.ts`, wired into all five meeting-creation
paths (direct upload, presigned init, transcript upload, Zoom ingest, Teams ingest).
Decision screen at `/settings/media-posture`; blocked-ingest banner in the app shell.

**Parked ingests (post-review hardening).** Automated paths that park now write a
durable `ParkedIngest` row (workspace, source, external ref, full job payload,
occurred-at) — a replayable work item, not just a log line. The posture screen lists
open parked items with an explicit per-item "Process now" action (OWNER_CCO only,
posture must be set first); replay re-publishes the original QStash job and a
successful ingest closes the row. These rows are proto coverage gaps and must feed
the CV-COV-06 queue when it lands, not become a second list.

**RETAIN → DISCARD (spec gap closed).** Switching posture never deletes anything.
After the switch, the posture screen offers a separate, explicitly confirmed and
audited purge (`purgeRetainedMedia`) for media ingested under the old policy. Each
deletion passes the CV-TR-07 readback gate; meetings without a secured transcript
are skipped and reported.

---

## CV-TR-07 — Discard source media after transcription ✅ done (2026-07-26)

Canonical transcript serialisation defined once (`canonicalTranscriptText` in
`src/server/export/txt.ts`) and used for BOTH `Meeting.transcriptSha256` and the
pack's `04_Transcript.txt` — one authoritative hash, byte-verified against real
pack output in the CV-TR-02a determinism suite.

`secureTranscript` (`src/server/retention/secure-transcript.ts`) persists the hash
on every transcript-storing path, then — only under DISCARD posture — deletes media
gated on a readback: re-read the persisted transcript, recompute, compare to the
stored hash, delete only on exact match. Delete runs after DRAFT_READY so a QStash
retry of a failed extraction never needs the deleted media. Failed storage deletes
leave media in place and audit `media_discard_failed`. Meeting page shows
"Source media discarded by policy on {date}" with the hash prefix.

---

## CV-TR-19 — Sealed exports are never watermarked ✅ done (2026-07-26)

`resolveExportWatermark({ purpose })` in `src/server/export/watermark.ts`.
Purpose `"seal"` always returns false; `"draft"` honours entitlement watermarking.
Manual export and `buildAuditPackZipForMeeting` (default draft) use the helper.
Seal callers pass `purpose: "seal"`. Determinism suite proves sealed hashes match
across trial and paid entitlements, and that a draft watermark changes the hash.

---

## CV-TR-01a — Sealed table privilege separation 🔨 deploy validation pending (2026-07-26)

`RecordSeal` schema and migration are implemented. The migration creates a
SQL-only `complyvault_app` role without `neon_superuser`, transfers table
ownership to a non-login owner group, grants the app role `SELECT/INSERT`, and
revokes `UPDATE/DELETE/TRUNCATE`. An append-only trigger raises SQLSTATE `42501`
as defense in depth. `scripts/provision-neon-app-role.sql` prompts for the
runtime password without storing it. The provisioned-DB integration test asserts
the app role is not the owner and that Postgres rejects UPDATE and DELETE.

**Remaining for full AC:** rotate the exposed Neon owner credential, run
`scripts/provision-neon-app-role.sql` to enable LOGIN on `complyvault_app`,
switch runtime `DATABASE_URL` to its pooled URL, and run CI with
`RECORD_SEAL_PRIVILEGE_TEST_DATABASE_URL` on a disposable Neon branch.

Neon note: table ownership remains with `neondb_owner` (Neon rejects
cross-role `OWNER TO`). The app role is still not the owner and has
SELECT/INSERT only.

---

## CV-TR-01 — Seal finalised packs to Object Lock ✅ code (2026-07-26)

`sealAndFinalizeMeeting` dual-write: generate sealed pack → SHA-256 → PUT
`SEALED_S3_BUCKET_NAME` keyed by hash with Object Lock retain-until `expiresAt` →
INSERT `RecordSeal` → UPDATE FINALIZED. Mode gated by `SEALED_OBJECT_LOCK_MODE`
(fail closed to GOVERNANCE). Nightly `/api/cron/seal-reconcile` asserts the
FINALIZED ↔ RecordSeal invariant (advance stuck seals; never un-finalise).

**Ops remaining:** provision Object Lock bucket; set `SEALED_S3_BUCKET_NAME` and
explicit `SEALED_OBJECT_LOCK_MODE=COMPLIANCE` only in production.

---

## CV-TR-02 — Hash ledger + pack cover ✅ code (2026-07-26)

Cover seal block: seal ID, pack hash (pass-1 content digest), sealed-at, Phase 1
copy (no verify URL). Ledger `packHash` = SHA-256 of complete sealed ZIP bytes.
FINALIZED export streams sealed object (hash matches ledger). Drafts omit seal
fields and may watermark.

---

## CV-TR-18 — External deposit custody ✅ code (2026-07-26)

SharePoint deposit runs only after seal commit. Filename includes seal ID;
deposit PDF carries custody footer naming the sealed record as system of record.
Deposit failure leaves FINALIZED + seal intact.

---

## CV-TR-16 — Supersede a sealed record ✅ code (2026-07-26)

New `Meeting` row via `supersedeMeeting`; original stays FINALIZED with seal and
flags untouched. OWNER_CCO + mandatory reason; `RECORD_SUPERSEDED` audit event.
Revert / reprocess / retry blocked on superseded originals and sealed replacements.
List/detail badges link original ↔ replacement. Deposit footer names prior seal
when the replacement seals (CV-TR-18).

**Migration:** `npx prisma migrate deploy` (or `migrate dev --name meeting_supersession`).

---

## CV-TR-17 — Supersession chain in exam pack ✅ code (2026-07-26)

`resolveSupersessionChain` + `06_Supersession_Chain.txt` in audit packs (ExamPack
consumer when EPIC-D lands). Chronological versions with seal IDs and reason
narratives between them; presented as one logical record.

---

## Remaining Phase 1 stories

CV-TR-01a (deployment verification), ops for sealed bucket / COMPLIANCE mode,
CV-TR-11 (SOC 2 — deferred; no certification spend required to close Phase 1 product work).

### CV-WEB-01 — Trust page ✅ code (2026-07-26)

Public `/trust` with implemented controls, SOC 2 status **Not started**, versioned
subprocessors, and direct download of `public/security/complyvault-security-overview.txt`
(no form gate). Legal hold omitted until CV-TR-05. `/privacy` and `/terms` stubs
added for Teams manifest URLs.

### CV-WEB-02 — Integrations narrative ✅ code (2026-07-26)

Homepage + trust page: Zoom auto-ingest live; manual upload for other platforms;
roadmap list separated with no dates. Vitest diffs
`MARKETING_LIVE_REGISTRY_KEYS` against `adapters` registry.

### CV-WEB-03 — ROI claims ✅ code (2026-07-26)

Removed unsupported “&lt;10 minutes” claim. Empty quantified-claims registry;
marketing-page grep fails CI on unsupported ROI / time-saved patterns.

### CV-WEB-04 — FCA claim ✅ code (2026-07-26)

`/uk` retired page states no FCA track; trial `source` no longer accepts
`complyvault.co/uk`.

### Sequencing (revised)

```
week 1 ── CV-TR-11 (optional / deferred — no spend required for Phase 1 close)
       ── CV-TR-01a (code done; deploy validation pending)
       ── CV-TR-02a ✅
       ── CV-TR-04 ✅ ─┬─ CV-TR-04a ✅
                      └─ CV-TR-06 ✅ ─── CV-TR-06a ✅ ─── CV-TR-07 ✅

CV-TR-02a ✅ + CV-TR-01a + CV-TR-19 ✅ ── CV-TR-01 ✅ ── CV-TR-02 ✅
                                      └── CV-TR-18 ✅
                                          └── CV-TR-16 ✅ ── CV-TR-17 ✅

CV-WEB-01 ✅ · CV-WEB-02 ✅ · CV-WEB-03 ✅ · CV-WEB-04 ✅
```
