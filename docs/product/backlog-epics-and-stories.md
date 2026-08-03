---
tags:
  - product
  - backlog
---

# ComplyVault MVP — Epics & Stories Backlog

**Source:** PRD — ComplyVault Communications & Exam Evidence MVP (v1.0, July 2026)
**Scope:** Modules A–E (Core Evidence Layer, M365 Email Integration, Email Compliance Audit, ExamPack Generator, Message Audit v1)
**Revision note (v1.1):** Incorporates the risk-based supervision amendments from the Janice Powell (SIM) feedback — documentation scope policy, meeting tiers, triage-signal reframing, risk-based review programme, and queue-health controls. See stories CV-A-10, CV-A-11, CV-C-09, CV-C-10 and the amended CV-C-02, CV-C-05, CV-D-04.

**Conventions**

- Story IDs: `CV-<epic>-<n>` (e.g. `CV-A-03`)
- Sizing: S (≤1 day), M (2–3 days), L (4–5 days), XL (needs splitting during sprint planning)
- Priority: P0 (blocks the phase exit demo), P1 (required for phase completion), P2 (can slip a phase)
- Every story that creates/modifies/deletes compliance data implicitly includes: audit-chain logging, soft delete only, no PII in logs. These are not repeated per story.

**Design principle — selectivity at the documentation layer, never the capture layer**

Capture is exhaustive within the declared scope (mailboxes/folders/date ranges); cherry-picking ingestion by content would be selective retention. Selectivity happens downstream and is policy-driven: the firm's Documentation Scope Policy (CV-A-10) determines what becomes a compliance record, what gets classified, and what is reviewed. AI outputs are **triage signals** (workflow metadata), not findings — a compliance record comes into existence only when a human opens a ReviewCase or Finding. The decision *not* to document is itself documented, versioned and sign-off gated. No path may quietly suppress capture or delete signals.

**Epic → Phase map**

| Epic | Module | Build phase | Exit demo |
| --- | --- | --- | --- |
| EPIC-0 Platform Foundation | cross-cutting | Phase 1 (spans all) | — |
| EPIC-A Core Evidence Layer | A | Phase 1 (Weeks 1–3) | Upload, tag, timeline, custody trail |
| EPIC-B M365 Email Integration | B | Phase 2 (Weeks 4–7) | Live mailbox connect → threads in vault |
| EPIC-C Email Compliance Audit | C | Phase 3 (Weeks 8–10) | 500-email seed → ranked risk queue → review |
| EPIC-D ExamPack Generator | D | Phase 4 (Weeks 11–12) | 10-minute request list → export |
| EPIC-E Message Audit v1 | E | Phase 5 (Weeks 13–14) | WhatsApp export → flags → exception → pack |

---

## EPIC-0 — Platform Foundation (cross-cutting)

> Infrastructure every module depends on: multi-tenancy enforcement, immutable storage, job queue, and the tamper-evident audit chain. Mostly built in Phase 1 alongside EPIC-A.

### CV-0-01 · Firm-scoped multi-tenancy middleware — P0 · M

As the platform, every query is automatically scoped by `firmId` so no firm can ever see another firm's evidence.

**Acceptance criteria**

- Prisma middleware (or tRPC context guard) injects/enforces `firmId` on all reads and writes for tenant-scoped models.
- A test proves cross-firm reads return zero rows even with a forged ID.
- All tRPC procedures touching evidence use `protectedProcedure` with role context.

### CV-0-02 · Immutable object storage for raw content — P0 · M

As the platform, raw content files (email bodies, attachments, imports) are stored in versioned, write-once object storage so originals can never be silently altered.

**Acceptance criteria**

- Bucket configured with versioning + object lock (or equivalent immutability guarantee).
- Upload path computes and stores `contentSha256`; a re-download utility verifies the hash matches.
- US-region storage for US firms (data-residency note from PRD §12).

### CV-0-03 · Job queue infrastructure — P0 · M

As the platform, long-running work (backfill, delta sync, classification, export) runs on a resumable queue, never blocking the UI.

**Acceptance criteria**

- BullMQ (or equivalent) wired with a worker process; `IngestJob` model tracks kind, status, cursor, stats.
- Jobs are resumable after worker crash (cursor-based checkpointing).
- Dead-letter/failure state surfaces in an admin view or log.

### CV-0-04 · Hash-chained AuditLog — P0 · L

As a compliance reviewer, every mutation across the platform writes a tamper-evident audit row so the chain of custody is provable.

**Acceptance criteria**

- `AuditLog` rows carry `prevHash` + `rowHash` = SHA-256(prevHash + canonical(payload)), chained per firm.
- A shared `writeAudit()` helper is the only write path; direct inserts are lint-blocked or code-review-flagged.
- Payloads never contain client names or financial data in plaintext beyond entity IDs.

### CV-0-05 · Nightly `verify-chain` job — P0 · S

As the platform, the audit chain is re-validated nightly so tampering is detected within 24 hours.

**Acceptance criteria**

- Scheduled job walks each firm's chain and recomputes hashes; mismatch raises an alert and writes a (chained) integrity event.
- Verification result visible to Admin role.

### CV-0-06 · Role-based access control — P0 · M

As any user, my access is scoped by role: Admin, CCO/Reviewer, Adviser (own clients only), External Consultant (read + review on assigned firms). *(PRD story A5)*

**Acceptance criteria**

- `Role` enum enforced in tRPC context; per-procedure role checks.
- Adviser queries filtered to own clients; External Consultant limited to assigned firms, read + review only.
- Unauthorized access attempts are audit-logged and return a clean error (no data leakage in message).

---

## EPIC-A — Core Evidence Layer (Module A / Phase 1)

> Generalise the data model so every artefact is an `EvidenceItem` with uniform tagging, review, retention, audit and export behaviour. Reuses the existing sign-off workflow and Cockpit UI shell.

### CV-A-01 · EvidenceItem schema + polymorphic detail tables — P0 · L

As the platform, all evidence types (meeting, email, message, document, policy, attestation, note, finding record) are backed by a single `EvidenceItem` table with `sourceType` + detail tables.

**Acceptance criteria**

- Prisma schema per PRD §9: `EvidenceItem`, `EvidenceTag`, `Communication`, `CommunicationThread`, `Attachment`, plus supporting enums, with `createdAt`/`updatedAt`/`deletedAt` on all models.
- Indexes on `(firmId, clientId, occurredAt)` and `(firmId, sourceType)`.
- DTOs defined in `src/lib/types.ts`; no raw Prisma models cross the tRPC boundary.
- Migration command surfaced: `npx prisma migrate dev --name evidence-item-core` + `npx prisma generate`.

### CV-A-02 · Migrate existing meeting docs onto EvidenceItem — P0 · L

As the platform, all existing meeting-documentation records become EvidenceItems with zero data loss.

**Acceptance criteria**

- Migration script + separate verification script comparing counts, key fields, and content hashes pre/post.
- Rollback plan documented; run against a staging snapshot before production.
- Migrated items get `sourceType: MEETING` and correct `occurredAt`.

⚠️ COMPLIANCE IMPACT: touches existing compliance records — verification script output must be retained as evidence of lossless migration.

### CV-A-03 · Compliance tagging — P0 · M

As a CCO, I can tag any EvidenceItem with compliance categories (advice, recommendation, complaint, fee, performance, marketing, review, vulnerable client) and filter/search by tag. *(PRD story A2)*

**Acceptance criteria**

- Tag add/remove via tRPC mutations; `addedBy` records userId or "AI".
- Tag removal is soft (audit event, tag marked removed) — never a hard delete.
- List views filter by one or more tags.

### CV-A-04 · Client evidence timeline — P0 · M

As a CCO, I can see every piece of evidence for a client in one chronological timeline regardless of source, so I can reconstruct the advice narrative. *(PRD story A1)*

**Acceptance criteria**

- `/clients/[id]/timeline` App Router page (server component + loading skeleton + error boundary).
- Chronological by `occurredAt`, with source-type icons, tags, and classification badges.
- Paginates smoothly at 10k+ items per client.

### CV-A-05 · Per-item custody trail view — P0 · M

As a compliance reviewer, I can see the tamper-evident audit trail (create, view, tag, review, export, retention events) for any item, with hash verification. *(PRD story A3)*

**Acceptance criteria**

- Item detail page shows chained audit events with actor, action, timestamp.
- "Verify" action recomputes the chain segment for the item and shows pass/fail.
- Viewing an item itself writes a VIEW audit event.

### CV-A-06 · Retention rules engine — P1 · M

As an admin, I can assign retention categories and the system computes destruction-eligible dates (SEC baseline: 5 years, first 2 easily accessible). *(PRD story A4)*

**Acceptance criteria**

- `RetentionRule` CRUD (Admin only); assigning a rule computes `destructionEligibleAt` from `occurredAt`.
- Nothing is auto-deleted; eligibility is informational and surfaces in a report.
- Retention assignment writes a RETENTION_EVENT audit row.

### CV-A-07 · Keyword search + bundle export — P0 · L

As a CCO, I can run keyword search across all evidence in my firm and export any result set as a bundle. *(PRD story A6 — keyword half; semantic in CV-A-08)*

**Acceptance criteria**

- Postgres FTS over titles/body text; results in <2s at 100k-item scale.
- Result-set export produces ZIP + manifest (hashes, sources) via a queued export job in `src/server/export/`.
- Export writes an EXPORT audit event per included item.

### CV-A-08 · Semantic search (pgvector) — P2 · L

As a CCO, keyword search is complemented by semantic search so conceptually related evidence is findable without exact terms.

**Acceptance criteria**

- pgvector embeddings generated on ingest (queued); hybrid ranking with FTS.
- <2s at 100k items; can slip to Phase 3 per PRD.

### CV-A-09 · Phase 1 demo seed script — P1 · S

As the founder, I can seed a demo firm with documents, tags, and a populated timeline to run the Phase 1 exit demo.

**Acceptance criteria**

- `scripts/seed-demo.ts` extension; records flagged `isDemo: true`; fictional firm/CRD only.
- Demo walks: upload → tag → timeline → custody trail without manual setup.

### CV-A-10 · Documentation Scope Policy — P0 · M

As a CCO, I can define a firm-level Documentation Scope Policy stating which meeting types, communication types and record categories are compliance-documented, light-touch, or out of scope — so the decision *not* to document is itself documented and defensible in an exam.

**Acceptance criteria**

- Policy model covers meeting types, communication types and record categories, each assigned a documentation tier (full / light-touch / out of scope), grounded in the Rule 204-2 record list (advice, recommendations, securities transactions, funds movement, performance).
- The policy is itself an EvidenceItem (`sourceType: POLICY`): versioned, sign-off gated via the existing multi-layer workflow, with full review history exportable into ExamPacks.
- Classification (CV-C-02), gaps reporting (CV-D-04) and meeting tiers (CV-A-11) read their scope from the active policy version.
- Policy changes apply prospectively only; every version change is audit-chained.
- A sensible default policy ships as a pre-approved template so firms are never in an undefined state.

⚠️ COMPLIANCE IMPACT: this is the firm's answer to "why isn't X documented?" — the policy and its review history are the evidence. Must exist before Phase 3, because classification behaviour depends on it.

### CV-A-11 · Meeting documentation tiers — P1 · M

As an adviser or CCO, meetings get a documentation tier at creation — Full audit documentation / Light note / No compliance record — defaulted by meeting type from the scope policy, so a prospect intro call and an annual suitability review don't produce the same weight of documentation.

**Acceptance criteria**

- Tier defaulted from the CV-A-10 policy by meeting type; override allowed but requires a logged reason and is audit-chained.
- "No compliance record" meetings still record the tier decision itself (date, type, policy version applied) — the existence of the decision is retained, not the content.
- Timeline (CV-A-04) shows tier badges; only Full-tier meetings enter classification and review workflows.

---

## EPIC-B — M365 Email Integration (Module B / Phase 2)

> Controlled ingestion of selected mailboxes/folders/date ranges into the evidence layer. Gmail is fast-follow, out of scope.

### CV-B-01 · M365 OAuth connect + mailbox selection — P0 · L ✅ done (2026-07-13)

As an admin, I can connect a Microsoft 365 tenant via OAuth (Graph API, application or delegated consent) and select which mailboxes are in scope. *(PRD story B1)*

**Acceptance criteria**

- Both admin-consent (application) and delegated-consent flows supported; least-privilege scopes (`Mail.Read` per approved mailbox).
- Tokens envelope-encrypted at rest in `MailboxConnection.encryptedToken`.
- Admin-consent setup guide written (doubles as sales collateral per PRD §12).

### CV-B-02 · Folder + date-range scoping — P0 · M ✅ done (2026-07-13)

As an admin, I can scope ingestion by folder and date range per mailbox (e.g. "Inbox + Sent, from Jan 2024"). *(PRD story B2)*

**Acceptance criteria**

- Folder picker reads live folder list from Graph; selection stored in `scopeFolders` + `backfillFrom`.
- Ingestion strictly honours scope — a test proves out-of-scope folders are never fetched ("controlled ingestion, not total archive").

### CV-B-03 · Backfill job (paged, resumable) — P0 · XL ✅ done (2026-07-13)

As the system, I backfill scoped mailboxes into EvidenceItems, preserving headers, participants, timestamps, message IDs and attachments; deduplicating by internet message ID. *(PRD story B3 — backfill half)*

**Acceptance criteria**

- 10k-message mailbox backfills without manual intervention; resumable after failure via `IngestJob.cursor`.
- Each message → `EvidenceItem` (+ `Communication` + `Attachment` rows); raw MIME stored immutably with `contentSha256`.
- Duplicate `internetMessageId` is skipped and counted in `IngestJob.stats`.
- Each ingested item is queued for classification (consumed by EPIC-C).

### CV-B-04 · Incremental delta sync — P0 · L ✅ done (2026-07-13)

As the system, connected mailboxes stay current via Graph delta queries (polling MVP; webhooks later). *(PRD story B3 — sync half)*

**Acceptance criteria**

- Delta cursor persisted per connection; polling interval configurable.
- Token expiry/revocation moves connection to `ERROR` with an admin-visible reason; recovery path documented.
- `lastSyncAt` visible in the connections admin UI.

### CV-B-05 · Thread grouping — P0 · M ✅ done (2026-07-13)

As the system, messages are grouped into threads correctly across replies and forwards.

**Acceptance criteria**

- Primary grouping by Graph `conversationId`; fallback to `References`/`In-Reply-To` headers.
- Test fixture set covering reply, forward, subject-change, and cross-mailbox cases passes.

### CV-B-06 · Participant matching + triage queue — P0 · L ✅ done (2026-07-13)

As the system, I match participants to Clients (Zoho contacts + local records) and Users (advisers), and mark unmatched external addresses for triage. *(PRD story B4)*

**Acceptance criteria**

- Exact address match auto-links (>95% precision target); fuzzy matches create unverified `EmailAlias` rows and land in a triage queue — never auto-linked.
- Triage UI: confirm, reassign, or mark external/irrelevant; confirming backfills the link to prior communications.
- Zoho One (EU DC) contact lookup integrated with graceful degradation if Zoho is unavailable.

### CV-B-07 · Thread reader UI — P0 · L ✅ done (2026-07-13)

As a CCO, I can view an email thread in a clean reader with attachments inline, tag it, open a ReviewCase from it, or add it to an ExamPack. *(PRD story B5)*

**Acceptance criteria**

- Thread view renders sanitized HTML bodies with participant/client badges; attachments previewable/downloadable (each download audit-logged).
- Actions: tag (reuses CV-A-03), open ReviewCase, add to ExamPack (button can be disabled until EPIC-D ships).
- Brand tokens: DARK_GREEN `#0D2818`, ACCENT_GREEN `#2ECC71`.

### CV-B-08 · Thread export (PDF + EML/ZIP + manifest) — P0 · L ✅ done (2026-07-13)

As a CCO, I can export any thread or selection as PDF + native EML/ZIP with a manifest (hashes, sources, custody). *(PRD story B6)*

**Acceptance criteria**

- Lives in `src/server/export/`; queued job, idempotent (same input → same output).
- Manifest lists every item's source, timestamps, participants, `contentSha256`.
- Export blocked-fields validation before returning; EXPORT audit events written.

### CV-B-09 · Redaction guard before third-party AI — P0 · M ✅ done (2026-07-13)

As the platform, no email content reaches any third-party AI provider without passing the classification pipeline's redaction step.

**Acceptance criteria**

- Single choke-point module through which all outbound AI calls flow; unit test proves raw ingestion content cannot bypass it.
- Redaction behaviour documented for the security one-pager.

---

## EPIC-C — Email Compliance Audit (Module C / Phase 3)

> The sellable product: a risk-based supervision programme, not exhaustive review. Two-stage AI classification produces **triage signals** — workflow metadata, not findings. A compliance record exists only when a human opens a ReviewCase or Finding. Classification scope is governed by the firm's Documentation Scope Policy (CV-A-10). Pitch: "ComplyVault doesn't flag everything — it runs your risk-based supervision programme and proves you followed it."

### CV-C-01 · Heuristic pre-filter (stage 1) — P0 · M

As the system, a cheap keyword/heuristic pass selects classification candidates plus a random sample of non-candidates (to measure the false-negative rate).

**Acceptance criteria**

- Taxonomy v1 signal lists (PRD §6 table) implemented as maintainable rule sets.
- Sampling rate for non-candidates configurable; sampled items marked so precision/recall can be computed later.
- Sampling mechanism is reused by the risk-based review programme (CV-C-09) — build it as a shared service, not an eval-only hook.

### CV-C-02 · LLM classification (stage 2) — P0 · XL *(amended)*

As the system, I classify in-scope candidate communications with categories, a 0–100 risk score, confidence, and a plain-English rationale, storing model + prompt version — producing **triage signals**, not findings. *(PRD story C1, amended per Janice Powell feedback)*

**Acceptance criteria**

- Classification runs only on items in scope per the active Documentation Scope Policy (CV-A-10); out-of-scope items record the skip decision (policy version applied), not a classification.
- Writes `AIClassification` rows with `category`, `riskScore`, `confidence`, `rationale`, `modelId`, `promptVersion`.
- Schema and UI language frame outputs as **triage signals** (workflow metadata) — never "findings", "violations" or "determinations". A compliance record comes into existence only when a human opens a ReviewCase or Finding (CV-C-04).
- PII-minimising prompt construction; calls flow through the CV-B-09 redaction guard.
- Every prompt/response pair logged for auditability (AI-governance evidence, sellable under 2025 exam priorities).
- Classification cost per 1k emails measured and logged (unit economics).
- Signals are append-only within their retention tier — no silent overwrite or deletion path (retention tiering per CV-C-05).

### CV-C-03 · Risk review queue — P0 · L

As a CCO, I see a review queue sorted by risk, filterable by category, adviser, client and date; each item shows the AI rationale and the underlying thread. *(PRD story C2)*

**Acceptance criteria**

- Reviewer clears a 50-item queue in one session without page reloads (optimistic updates / client-side navigation).
- Inline thread preview + full rationale + confidence per item.
- Every reviewer action writes to the audit chain.

### CV-C-04 · Approve / dismiss / escalate + Findings — P0 · L

As a reviewer, I can approve, dismiss (with reason), or escalate; escalation creates a Finding with status, owner, notes and remediation record. *(PRD story C3)*

**Acceptance criteria**

- Dismiss requires a reason code; nothing is deletable.
- Escalation creates `Finding` (severity, summary, status, remediation JSON) linked to the `ReviewCase`; sign-offs reuse the existing multi-layer engine.
- Reviewer outcome written back to `AIClassification.humanOutcome` (feeds the eval set).

### CV-C-05 · Per-category sensitivity tuning + signal retention tiers — P1 · M *(amended)*

As a CCO, I can tune sensitivity per category (thresholds) — but I can never disable capture. Below-threshold signals are labelled non-determinations with a shorter workflow-retention tier, so the firm isn't accumulating indefinite discoverable risk scores on every email. *(PRD story C4, amended)*

**Acceptance criteria**

- Thresholds affect queue surfacing only; no UI or API path disables capture; threshold changes are audit-logged with before/after values.
- Below-threshold signals are clearly labelled **non-determinations** (no human review occurred, no compliance conclusion drawn) and assigned a workflow-retention tier shorter than compliance-record retention.
- Human-touched items (any ReviewCase/Finding) are excluded from the shorter tier — once reviewed, standard compliance retention applies.
- Retention-tier expiry of non-determinations is itself a chained RETENTION_EVENT (the disposal decision is documented; underlying captured content is untouched).
- Retention-tier durations are firm-configurable within guardrails and recorded in the Documentation Scope Policy (CV-A-10).

⚠️ COMPLIANCE IMPACT: requires legal review before implementation — the workflow-retention tier for non-determinations must be validated against Rule 204-2 and books-and-records guidance. Indefinitely storing risk scores on unreviewed mail is the discoverable-awareness liability this story exists to prevent; getting the retention boundary wrong in either direction is a real exposure.

### CV-C-06 · Adviser / client flag dashboards — P1 · M

As a CCO, I can see per-adviser and per-client flag summaries (seed of the future Supervision Cockpit — single-firm only). *(PRD story C5)*

**Acceptance criteria**

- Counts by category/severity per adviser and per client, with drill-through to the queue filtered accordingly.
- Single-firm scope only; no cross-firm rollups in MVP.

### CV-C-07 · Evaluation set + precision/recall tracking — P1 · M

As the founder, human-review outcomes feed an evaluation set so classification precision/recall per category is tracked from day one.

**Acceptance criteria**

- Metrics computed per category from `humanOutcome` data; target >85% precision on advice + complaint by end of Phase 3.
- False-negative estimate derived from the CV-C-01 random sample.
- Simple internal metrics view or exportable report.

### CV-C-08 · 500-email demo seed mailbox — P1 · M

As the founder, a seeded 500-email mailbox produces a realistic ranked risk queue for the Phase 3 exit demo.

**Acceptance criteria**

- Fixture emails cover all eight taxonomy categories with plausible content; `isDemo: true`.
- Demo path: seed → queue of ranked risks → approve/dismiss/escalate live.
- Demo narrative includes the risk-based programme evidence report (CV-C-09) — the direct answer to the Janice Powell objection.

### CV-C-09 · Risk-based review programme — P0 · L *(new)*

As a CCO, I configure a written risk-based review programme — targeted review of top-risk signals plus a random sampling percentage — and ComplyVault generates evidence that the programme ran as configured, mirroring accepted communications-supervision practice.

**Acceptance criteria**

- Programme configuration per firm: targeted-review rules (categories, risk thresholds, top-N) + sampling percentage over non-flagged mail; configuration stored as a versioned, sign-off-gated EvidenceItem alongside the Documentation Scope Policy (CV-A-10).
- Elevates the CV-C-01 random sample from an internal eval mechanism into the supervision feature: sampled items enter the review queue labelled as programme samples.
- Per-period programme evidence report: what the configuration was, what was surfaced, what was sampled, what was reviewed, by whom — exportable and attachable to ExamPacks (CV-D-02).
- Product copy never implies exhaustive review; the claim is "your programme, executed and evidenced".
- Programme execution shortfalls (e.g. sampling target missed) are surfaced to the CCO, never silently dropped.

### CV-C-10 · Queue health & aging controls — P0 · M *(new)*

As a CCO, the review queue cannot silently accumulate an unreviewed backlog — because a queue of 3,000 stale flags during an exam is worse than no tool at all.

**Acceptance criteria**

- Aging alerts: signals unreviewed past configurable thresholds (e.g. 30/60/90 days) escalate visibly to the CCO and appear on the dashboards (CV-C-06).
- Reviewer-capacity-aware surfacing: the queue presents top-N by risk within the programme's configured scope (CV-C-09), not an unbounded backlog.
- Bulk-dismiss path with mandatory reason code, including "out of scope per documentation policy" (linked to the CV-A-10 policy version); bulk actions are audit-chained per item.
- Queue-health metrics (median age, oldest item, throughput vs. inflow) visible to the CCO; sustained negative trend raises an alert.
- No mechanism hides or auto-expires unreviewed high-risk signals — aging makes them louder, not quieter.

---

## EPIC-D — ExamPack Generator (Module D / Phase 4)

> The demo-winning feature: an indexed, sign-off-gated evidence bundle against an exam request list, exported with a full chain-of-custody manifest.

### CV-D-01 · ExamPack + request-list templates — P0 · M

As a CCO, I can create an ExamPack from a template request list (SEC exam categories: books & records, communications, marketing, code of ethics, annual review) or build a custom list. *(PRD story D1)*

**Acceptance criteria**

- `ExamPack` / `ExamRequest` models per PRD schema; template lists seeded with `refCode`s (e.g. "II.A.3").
- Custom lists: add/edit/reorder request lines; pack status lifecycle DRAFT → IN_REVIEW → SIGNED_OFF → EXPORTED.
- Template copy uses pre-approved strings only — no generated SEC citations.

### CV-D-02 · Evidence attach + AI-suggested candidates — P0 · L

As a CCO, I can attach any EvidenceItems to each request line, with AI-suggested candidates ranked by relevance. *(PRD story D2)*

**Acceptance criteria**

- Attach via search/browse (reuses CV-A-07/08) or from thread reader (CV-B-07); `ExamPackItem` unique per (request, item).
- AI suggestions ranked by relevance with visible rationale; suggestions are never auto-attached — CCO confirms each.
- Attach/detach audit-logged; detach is soft.

### CV-D-03 · AI per-request draft summaries — P1 · M

As the system, I generate a per-request AI summary of what the attached evidence shows — clearly labelled as a draft for reviewer approval. *(PRD story D3)*

**Acceptance criteria**

- Summary stored in `ExamRequest.aiSummary`; UI labels it "AI draft — requires reviewer approval" until signed off.
- Model + prompt version logged; regeneration appends, never silently replaces approved text.

### CV-D-04 · Gaps report — P0 · M *(amended)*

As a CCO, I see a gaps report measured against my firm's Documentation Scope Policy — request lines with no evidence, weak evidence, or unresolved Findings. An item the policy classifies as out of scope is not a gap. *(PRD story D4, amended)*

**Acceptance criteria**

- Per-pack report flags: zero attachments, low-relevance-only attachments, and attached items with open/remediating Findings.
- Gap determination reads the active Documentation Scope Policy (CV-A-10): policy-out-of-scope items are shown as "out of scope per policy vN" (with a link to the policy), not as gaps.
- Linked navigation from each gap to fix it (attach evidence or open the Finding).

### CV-D-05 · Section sign-off gating — P0 · M

As a reviewer, I sign off each section (reusing the existing multi-layer sign-off workflow) before export is unlocked. *(PRD story D5)*

**Acceptance criteria**

- Export disabled until every `ExamRequest` has required sign-offs.
- Admin override possible but requires a logged reason and writes an OVERRIDE audit event.

⚠️ COMPLIANCE IMPACT: sign-off gating is the liability answer promised in sales conversations (Janice Powell) — the override path must be conspicuous in the audit trail.

### CV-D-06 · ZIP + index PDF export with custody manifest — P0 · XL

As a CCO, I export a ZIP + index PDF: table of contents, per-item source, dates, owners, reviewer, content hash — a full chain-of-custody manifest. *(PRD story D6)*

**Acceptance criteria**

- 200-item pack exports in <5 minutes; deterministic manifest (same pack state → identical manifest hash, stored in `exportManifestSha256`).
- Index PDF validated for required fields before release to client; queued job, never synchronous.
- All original metadata preserved (timestamps, participants, topics).

### CV-D-07 · 10-minute demo path — P1 · S

As the founder, the seeded demo firm supports the full flow — pre-loaded request list → attach evidence → gaps report → export — in under 10 minutes live.

**Acceptance criteria**

- Scripted demo checklist; dry-run timed under 10 minutes.
- Seed data includes a partially-complete pack so the gaps report has content.

---

## EPIC-E — Message Audit v1 (Module E / Phase 5)

> Off-channel evidence for exams via manual upload only — no channel connectors. Product copy promises a defensible supervision workflow, never "capture of personal messages".

### CV-E-01 · WhatsApp TXT parser — P0 · L

As a CCO, I can upload a WhatsApp TXT/ZIP export and see parsed threads.

**Acceptance criteria**

- ≥95% of messages parse correctly on a 1k-message test file (timestamps, senders, media placeholders).
- Unparsed lines preserved raw and visible — never dropped.
- Original file stored immutably with `originalSha256`; every parsed message links back to the source file (custody).

### CV-E-02 · SMS CSV + Teams/Slack best-effort importers — P1 · L

As a CCO, I can import SMS (CSV/TXT, column-mapped) and Teams/Slack exports (HTML/CSV/JSON, best-effort); screenshots/PDFs are stored as documents (OCR deferred).

**Acceptance criteria**

- Column-mapping UI for SMS; structured best-effort parse for Teams/Slack with parse stats surfaced.
- Unparseable uploads still stored as `DOCUMENT` EvidenceItems with hash — nothing rejected outright.

### CV-E-03 · Sender mapping + unified reader — P0 · M

As a CCO, I map senders to Users/Clients during import and see parsed threads in the same reader UX as email. *(PRD story E1)*

**Acceptance criteria**

- Mapping step reuses the triage/alias machinery from CV-B-06; unresolved senders go to triage.
- Threads render in the CV-B-07 reader with channel badge (`WHATSAPP_IMPORT` etc.).

### CV-E-04 · Off-channel classification — P0 · S

As the system, imported messages run through the same classification pipeline with an `off-channel` source flag. *(PRD story E2)*

**Acceptance criteria**

- Imports enqueue to the EPIC-C pipeline unchanged; `OFF_CHANNEL` tag applied by source, visible in queue filters.

### CV-E-05 · Channel register + exception workflow — P0 · L

As a CCO, I maintain an approved/prohibited channel register and log any discovered off-channel communication as an Exception with a remediation workflow (upload → classify → review → outcome). *(PRD story E3)*

**Acceptance criteria**

- `ChannelRegisterEntry` CRUD (Admin/CCO); `OffChannelException` records discovery source, linked evidence, ReviewCase, and outcome.
- Exception lifecycle drives from the existing ReviewCase/Finding machinery — no parallel workflow.

### CV-E-06 · Quarterly staff attestations — P1 · M

As an admin, I can run quarterly staff attestations ("I have not used unapproved channels"), stored as EvidenceItems and exportable into ExamPacks. *(PRD story E4)*

**Acceptance criteria**

- Attestation campaign per period (e.g. "2026-Q3"); each response creates an `Attestation` + linked `EvidenceItem` (attestations ARE evidence).
- Outstanding/completed status per user visible to Admin; completed attestations attachable to ExamPack request lines.
- Statement text uses pre-approved template strings only.

### CV-E-07 · Phase 5 demo seed — P2 · S

As the founder, a seeded WhatsApp export demonstrates: upload → flagged advice messages → exception remediation → evidence in pack.

**Acceptance criteria**

- Fixture export contains flaggable advice/off-channel content; `isDemo: true`; scripted end-to-end in under 10 minutes.

---

## Dependency graph (story level)

```
EPIC-0 (CV-0-01..06) ──► everything
CV-A-01 ──► CV-A-02..11, CV-B-03, CV-E-01
CV-A-03 ──► CV-B-07, CV-C-03
CV-A-10 ──► CV-A-11, CV-C-02, CV-C-05, CV-C-09, CV-C-10, CV-D-04  (scope policy governs classification, retention tiers, programme config, bulk-dismiss reasons, gap determination)
CV-B-01 ──► CV-B-02 ──► CV-B-03 ──► CV-B-04, CV-B-05
CV-B-06 ──► CV-E-03
CV-B-09 ──► CV-C-02
CV-C-01 ──► CV-C-02 ──► CV-C-03 ──► CV-C-04 ──► CV-C-07
CV-C-01 ──► CV-C-09 (shared sampling service)
CV-C-09 ──► CV-C-10 (queue surfacing scoped by programme config)
CV-A-07 ──► CV-D-02
CV-C-04 ──► CV-D-04 (Findings feed the gaps report)
CV-C-09 ──► CV-D-02 (programme evidence reports attachable to packs)
CV-D-05 ──► CV-D-06 (export gated on sign-off)
CV-E-01/02 ──► CV-E-03 ──► CV-E-04 ──► CV-E-05
```

## Suggested story counts per phase

| Phase | Stories | P0 | Notes |
| --- | --- | --- | --- |
| 1 | CV-0-01..06, CV-A-01..07, CV-A-09 | 12 | CV-A-08 (semantic) may slip to Phase 3 |
| 2 | CV-B-01..09, CV-A-10, CV-A-11 | 10 | CV-B-09 and CV-A-10 must both land before any Phase 3 classification — scope policy governs what gets classified |
| 3 | CV-C-01..10 (+ CV-A-08 if slipped) | 8 | CV-C-09 (risk-based programme) and CV-C-10 (queue health) are exit-demo material — they carry the Janice Powell answer; CV-C-05 needs legal review of the retention tier before build |
| 4 | CV-D-01..07 | 5 | Export determinism (CV-D-06) is the hardest story; gaps report now reads the scope policy |
| 5 | CV-E-01..07 | 4 | WhatsApp parser first per PRD |

## Guardrail (do not trade away)

Selectivity is permitted only when it is policy-driven, written down, consistently applied, and itself auditable. If future feedback pushes toward quietly disabling flags, suppressing capture by content, or deleting signals outside the documented retention tiers — the product says no. That line is what makes this position defensible to a CCO, an ex-SEC validator, and an examiner alike.
