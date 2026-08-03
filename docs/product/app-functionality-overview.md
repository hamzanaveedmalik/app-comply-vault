---
tags:
  - product
  - as-built
---

# ComplyVault — Application Functionality Overview

A high-level, whole-product reference describing what ComplyVault does, how the
pieces fit together, and what is implemented today versus planned. Grounded in
the current codebase (`src/`, `prisma/schema.prisma`, `src/app/api`). For deeper
detail see the companion docs referenced at the end.

> Legend: **Live** = implemented and wired end to end · **Partial** = present
> but scoped/limited · **Planned** = PRD scope, schema/UI stub only.

---

## 1. What the product is

ComplyVault is a compliance documentation platform for Registered Investment
Advisers (RIAs). It turns raw client interactions — meeting recordings,
transcripts, and email threads — into exam-ready, human-reviewed compliance
records, and pushes those records into the tools firms already use (document
storage, CRM). The guiding principle: **AI surfaces what needs attention; a
human decides; every decision is preserved for an SEC exam.**

Core value loop:

```
Capture  →  AI triage  →  Human review & sign-off  →  Audit pack  →  Sync out
(meetings,   (transcribe,   (advisor / CM / CCO       (PDF/CSV/TXT   (SharePoint,
 email)       extract,       three-layer workflow)      + manifest)    Zoho CRM)
              flag)
```

---

## 2. Users, roles & tenancy

- **Multi-tenant by workspace.** Every record hangs off a `Workspace`; all
  queries are workspace-scoped. A user can belong to multiple workspaces
  (`UserWorkspace`) and switch between them.
- **Roles** (`WorkspaceRole`): **OWNER_CCO**, **MEMBER**, and supporting review
  roles. The review workflow recognises three functional actors:
  - **Advisor** — certifies the meeting record is accurate.
  - **Compliance Manager (CM)** — triages every AI flag (resolve / note /
    escalate).
  - **CCO** — provides final regulatory sign-off, sees only escalated items,
    and can batch-approve clean meetings.
- **Auth**: NextAuth (credentials + session), email verification, and
  invitation-based team onboarding with role assignment.

---

## 3. Core concepts (glossary)

| Concept | Meaning |
|---|---|
| **Meeting** | A captured client interaction (recording/transcript) moving through the review lifecycle. |
| **Flag** | An AI-surfaced compliance signal (triage), not a "finding" until a human escalates it. Types: missing disclosure, conflict language, missing suitability basis. |
| **Firm profile / disclosure categories** | Firm-level config of which disclosures are required vs "covered elsewhere," used to tune flagging. |
| **Audit pack** | The exam-ready export bundle for a meeting (structured summary, flags, resolutions, evidence, manifest). |
| **Evidence / communication thread** | Email and message records (M365 mailbox) captured and tagged as compliance evidence. |
| **Audit event** | Append-only log entry recording every consequential action. |
| **Integration credential/config** | Encrypted OAuth tokens + per-workspace settings for a connected external system. |

---

## 4. Functional areas

### 4.1 Capture (getting interactions in) — **Live / Partial**

Multiple ingestion paths all converge on the same processing pipeline:

- **Manual upload** (Live): presigned S3/R2 upload of audio/video or a
  transcript file, then processing is enqueued.
- **Zoom** (Live): OAuth connect, webhook on `recording-completed`, async
  ingest of recording/transcript (VTT preferred), plus recording scope
  (all vs external-only).
- **Microsoft Teams** (Live): OAuth connect, transcript and call-record
  webhooks, ingest jobs, and a Teams App manifest (generate/view/status) with
  a side panel and config page.
- **Email / M365 mailbox** (Live): mailbox connection with consent modes,
  delta sync (cron + on-demand), message ingestion, participant matching to
  clients, and thread grouping into `CommunicationThread`s.

### 4.2 AI processing pipeline — **Live**

Runs asynchronously off the capture step (see §6):

- **Transcription** of media via pluggable ASR providers (AssemblyAI,
  Deepgram; provider abstraction in `src/server/transcription`).
- **Extraction** of structured compliance content — topics, recommendations,
  disclosures, decisions, follow-ups, and an evidence map — via pluggable LLM
  providers (OpenAI / Anthropic / Vertex).
- **Flagging / triage** — rules + AI detect missing disclosures, conflict
  language, and missing suitability basis, with severity (INFO/WARN/CRITICAL)
  and firm-profile-aware suppression. Flags carry evidence links back into the
  transcript.
- **Guardrails**: redaction guard before content leaves for an LLM, prompt
  logging, and a regulatory-language guard (see AI standards docs).

### 4.3 Review & three-layer sign-off — **Live**

The heart of the product. Meeting lifecycle
(`MeetingStatus`):

```
UPLOADING / PROCESSING → DRAFT_READY → ADVISOR_CERTIFIED
    → CM_REVIEWED → CCO_SIGNED_OFF → FINALIZED
```

- **Layer 1 — Advisor certification**: advisor confirms the record is accurate,
  can edit fields; edits are versioned (`Version`) with who/what/why.
- **Layer 2 — CM flag triage**: each flag is resolved, noted, escalated,
  accepted-as-risk, or marked not-applicable; remediation tasks and evidence
  can be attached.
- **Layer 3 — CCO sign-off**: CCO reviews escalations, signs off (single or
  batch), or reverts the workflow. "Ready for CCO" and revert paths exist.
- Every transition is timestamped with reviewer identity and written to the
  audit trail; a finalize reason/note is captured on completion.

### 4.4 Communications & email triage — **Live**

- Client-centric view of communications: threads, individual messages,
  attachments, direction/channel, and client status.
- **Email triage queue**: surfaces items needing attention with resolve
  actions; results feed evidence.
- **Evidence tagging**: messages/threads can be tagged into compliance
  categories and exported as thread exports.

### 4.5 Compliance cockpit & firm intelligence — **Live / Partial**

- **CRD firm lookup** (Live): look up a firm by CRD (SEC/IAPD source) to seed
  the firm profile.
- **Configurable disclosure profiles** (Live): mark disclosure categories as
  required or "covered elsewhere," with a locked set of always-required
  disclosures and a configurable set; changes are logged and require approval
  (`FirmProfileVersion`, `SuppressionLogEntry`, approval flow).
- **Risk flags → queue ranking** (Partial): firm risk attributes raise the
  priority of related flags in review.

### 4.6 Audit packs & export — **Live**

- Per-meeting audit pack generation in **PDF, CSV, and TXT**, plus a
  chain-of-custody manifest.
- Server-side data pull (never trusts client data), required-field validation,
  and mandatory audit-log entry on every export.
- Thread/communication exports for email evidence.

### 4.7 Integrations (destinations) & platform — **Live / Partial / Planned**

Foundation: adapter interface, encrypted OAuth token storage with auto-refresh,
async write queue (BullMQ when Redis configured, else QStash), webhook
signature verification, health/failure surfacing, disconnect-and-delete, manual
retry, and an internal ops dashboard.

| Provider | Status | Notes |
|---|---|---|
| Zoom | Live | Capture (OAuth + webhook + ingest) |
| Microsoft Teams | Live | Capture (OAuth + webhooks + manifest) |
| SharePoint / OneDrive | Live | Auto-deposit audit packs after finalize |
| Zoho CRM | Live | Auto-note to matched Contact; contact linking on meeting |
| M365 Mail | Live | Mailbox capture + delta sync |
| DocuSign | Planned | Connect verification helper only |
| Redtail / Wealthbox / Salesforce | Planned | Enum/UI only |
| Google Drive / SmartVault / Slack / Teams Bot | Planned | PRD phases 2–3 |

### 4.8 Ask ComplyVault (AI assistant) — **Live**

Natural-language Q&A over the workspace's compliance data with retrieval,
keyword handling, rate limiting, a regulatory-answer guard, and audit logging
of each AI query (`AI_QUERY`).

### 4.9 Dashboard & reporting — **Live**

Compliance-first command centre: health/KPI summary, recent meetings, action-
required items, integration health, and coverage — assembled server-side in
`src/server/dashboard`.

### 4.10 Notifications — **Live / Partial**

- Transactional email (draft/audit-pack ready) and a weekly digest cron via
  Resend (Live).
- In-app notification list + unread count (Live).
- Slack / Teams bot alerts (Planned).

### 4.11 Audit trail — **Live**

Append-only `AuditEvent` log covering uploads, views, edits, finalize, exports,
deletes, remediation, verifications, overrides, invitations, workflow
transitions, disclosure-suppression changes, mailbox events, evidence actions,
and AI queries. Exportable for exam evidence.

### 4.12 Billing — **Live**

Stripe-based: checkout/setup, plan tiers and currency, billing status,
webhooks, trial requests, and entitlement/guard checks gating features.

### 4.13 Search — **Live**

Workspace-scoped full-text search over meetings (PostgreSQL `to_tsvector` on a
size-capped `searchableText`), plus filterable queues.

### 4.14 Internal / ops — **Live**

Ops stats page, integration health/failure inspection, and admin utilities
(e.g. meeting flush) behind internal access.

### 4.15 AdvizorStack partner demo — **Live (illustrative)**

Self-contained, unauthenticated demo at `/demo/advizorStack` (Home, Review
queue, Evidence review, Sources, Compliance cockpit) using seed data only, for
partner storytelling. Never wired to real auth or destinations.

---

## 5. Data model (high level)

Principal entities and relationships (see `prisma/schema.prisma` for the full
set of ~40 models/enums):

```
Workspace ─┬─ UserWorkspace ── User (Account, Session)
           ├─ Meeting ─┬─ Version
           │           ├─ Flag ─── ResolutionRecord / EvidenceLink / Verification
           │           ├─ ActionItem
           │           └─ IntegrationSyncLog
           ├─ FirmProfile ─┬─ DisclosureCategory
           │               ├─ SuppressionLogEntry
           │               └─ FirmProfileVersion
           ├─ Client ─┬─ EmailAlias
           │          └─ CommunicationThread ── Communication ── Attachment
           ├─ MailboxConnection ── IngestJob / EmailTriageItem
           ├─ EvidenceItem ── EvidenceTag
           ├─ IntegrationCredential / IntegrationConfig
           ├─ Invitation / Lead
           └─ AuditEvent  (append-only, workspace-wide)
```

Conventions: `id/createdAt/updatedAt`, soft-delete where relevant, indexes on
workspace-scoped query paths, and typed DTOs returned rather than raw Prisma
models.

---

## 6. Architecture & processing model

- **Framework**: Next.js 15 App Router (React 19), Tailwind CSS 4, Radix +
  shadcn-style UI in `src/components/ui/`.
- **Layers**: pages/server components (`src/app`) → HTTP route handlers
  (`src/app/api`) → server domain modules (`src/server`) → Prisma/PostgreSQL +
  S3-compatible object storage.
- **Async work**: long-running steps run as jobs triggered via Upstash QStash
  HTTP callbacks (transcription/extraction, ingest chains, SharePoint deposit,
  Zoho note, token refresh, queue processing); BullMQ + Redis used for the
  integration-write queue when `REDIS_URL` is set.
- **External services** (when configured): Zoom, Microsoft Graph (Teams +
  SharePoint + Mail), Zoho CRM, Resend, Stripe, LLM providers, ASR providers,
  SEC/IAPD CRD lookup.

Representative meeting flow:

```
upload/webhook → /api/jobs/zoom|teams|mailbox ingest → /api/jobs/process-meeting
  → transcribe → extract → flag → DRAFT_READY (notify)
  → advisor certify → CM review → CCO sign-off → finalize
  → /api/jobs/sharepoint-deposit + /api/jobs/zoho-crm-note
```

---

## 7. Route map (representative)

**App pages** (`src/app/(app)`): `dashboard`, `interaction-log`, `review`,
`upload`, `meetings/[id]` (transcript, flags, versions, export, sign-off),
`communications` + `threads/[id]`, `mailbox/triage`, `compliance-cockpit`,
`integrations` (+ `zoho`, `m365-mail`, `teams/manifest`), `audit-logs`,
`audit-packs`, `notifications`, `settings` (+ `workspace`), `welcome`,
`workspaces/new` + invite. Plus `auth/*`, `invitations/accept`, `teams/*`, and
the `demo/advizorStack` route group.

**API** (`src/app/api`): auth, upload (init/complete/transcript), meetings CRUD
+ lifecycle (`certify`, `cm-review`, `cco-signoff`, `ready-for-cco`,
`revert-workflow`, `finalize`, `export`, `versions`, `reprocess`,
`integration-sync`), flags (`cm-triage`, `remediation`), firm-profile
(categories/approve/suppression-log), mailbox (connections/threads/triage),
integrations (connect/callback/disconnect per provider), jobs/* (async
workers), webhooks/v1/* (Zoom/Teams), cron/* (weekly digest, mailbox delta),
workspaces + invitations + team, billing, trial, notifications, search,
audit-logs, metrics, iapd CRD lookup, and `ask`.

---

## 8. Non-functional & compliance guardrails

- **Multi-tenancy isolation** enforced on every query; tenancy tests exist.
- **Audit integrity**: append-only events; exports and sign-offs always logged.
- **Regulatory-accuracy discipline**: AI output labelled as triage/pending
  review (not "findings/violations"); regulatory citations come from approved
  templates; redaction before LLM calls; human-in-the-loop before finalize.
- **Security**: encrypted integration tokens, webhook signature verification,
  presigned storage URLs (no raw paths exposed), entitlement guards.
- **Performance**: paginated/virtualised queues, URL-driven filters, size-
  capped full-text search.

---

## 9. Implementation status at a glance

- **Live end to end**: capture (upload/Zoom/Teams/M365 mail), AI pipeline,
  three-layer sign-off, communications & email triage, firm disclosure
  profiles + CRD lookup, audit packs (PDF/CSV/TXT), SharePoint + Zoho CRM sync,
  Ask ComplyVault, dashboard, notifications (email/in-app), audit trail,
  billing, search, ops.
- **Partial**: risk-based queue ranking; some notification channels.
- **Planned (PRD)**: DocuSign, Redtail/Wealthbox/Salesforce, Google
  Drive/SmartVault, Slack/Teams bots — see `prd-summary.md` and phased rollout.

---

## 10. Related documents

- Architecture (as-built): `docs/architecture/architecture-as-built.md`
- Architecture (target/diagrams): `docs/architecture/architecture-diagrams.md`
- Product scope & epics: `docs/product/prd-summary.md`, `docs/product/complyvault-plugin-prd.md`
- Three-layer sign-off: `docs/compliance/three-layer-signoff.md`
- Compliance cockpit: `docs/compliance/compliance-cockpit.md`
- Ask ComplyVault: `docs/product/ask-complyvault.md`
- Onboarding: `docs/ux/onboarding-flow.md`
- User-facing: `docs/operations/USER_GUIDE.md`, `docs/operations/FAQ.md`, `docs/ux/user-journeys.md`

## Related documentation

- Prefer on conflict: [[product-as-built]]
- [[architecture-as-built]] · [[architecture-diagrams]]
- [[compliance-cockpit]] · [[three-layer-signoff]] · [[ask-complyvault]]
- [[Product-Map|Product Map]]
