# Backlog: Phase 1 — Seal and Publish (v1.1, patched)

**Source PRD:** `docs/prd-trust-coverage-distribution.md` v2.0  
**Epic:** EPIC-TR (Trust Layer)  
**Supersedes:** `backlog-phase1-trust.md` v1.0  
**Window:** Weeks 1 to 7  
**Status:** 🔨 in progress — CV-TR-02a ✅; CV-TR-04 / 04a schema+API ✅; CV-TR-06 / 06a ✅; CV-TR-07 ✅ (2026-07-26)

**Patch summary.** Added CV-TR-02a (deterministic bytes, fail-closed gate), CV-TR-04a and CV-TR-06a (existing-tenant migrations), CV-TR-18 (external deposit custody), CV-TR-19 (watermark exclusion). Rewrote CV-TR-01 dual-write as a content-addressed idempotent protocol. Removed coverage AC from CV-TR-17. Corrected cover-page copy, retention default conflict, timezone arithmetic, role names, discard scope, and the CV-WEB-02 integration inventory. Fixed `postureSetById` / `postureSetAt`.

**Sequencing fix (post-review).** CV-TR-19 and CV-TR-18 gate or ship with CV-TR-01 (not after). Seal timestamp is captured once at protocol start and injected into pack bytes.

**Role naming.** All stories use the code role `OWNER_CCO`. `COMPLIANCE_MANAGER` cannot set media posture, finalise, or supersede.

---

## CV-TR-02a — Deterministic pack bytes ✅ done (2026-07-26)

**Story.** As the system, I must produce byte-identical audit packs for the same record on every export, because a hash of nondeterministic bytes is a false integrity claim rather than a weak one.

**Blocks:** CV-TR-01. No seal may land until this passes.

**Done.** `src/server/export/deterministic.ts`, payload/ZIP/PDF timestamp normalisation, CI tests under UTC and Pacific/Auckland.

---

## CV-TR-04 / CV-TR-04a — Fiscal-year retention ✅ schema+API (2026-07-26)

**Remaining for full AC:** one-time post-migration notice banner for existing OWNER_CCOs (CV-TR-04a notice).

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

## Remaining Phase 1 stories

CV-TR-04, CV-TR-04a, CV-TR-06, CV-TR-06a, CV-TR-07, CV-TR-01a, CV-TR-01, CV-TR-02, CV-TR-19, CV-TR-16, CV-TR-17, CV-TR-18, CV-TR-11, CV-WEB-01..04.

### Sequencing (revised)

```
week 1 ── CV-TR-11 (external, runs throughout)
       ── CV-TR-01a (infra: sealed bucket + DB role split)
       ── CV-TR-02a (deterministic bytes)  ← current
       ── CV-TR-04 ─┬─ CV-TR-04a
                    └─ CV-TR-06 ─── CV-TR-06a ─── CV-TR-07

CV-TR-02a + CV-TR-01a + CV-TR-19 ── CV-TR-01 ── CV-TR-02
                                      └── CV-TR-18 (same release as TR-01)
                                          └── CV-TR-16 ── CV-TR-17

CV-WEB-02, 03, 04 independent
CV-WEB-01 gated on CV-TR-11 start date
```
