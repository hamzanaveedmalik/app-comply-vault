# PRD — ComplyVault Communications & Exam Evidence MVP

**Version:** 1.0 · July 2026
**Owner:** Hamza Naveed
**Scope:** Items 1–5 of the agreed build order — Core Evidence Layer, M365/Outlook Email Integration, Email Compliance Audit, ExamPack Generator, Message Audit (manual upload)
**Out of scope for this MVP:** Chatbot, Adviser Desk, Policy Copilot, ReviewTrack, message-channel connectors (Teams/Slack/WhatsApp APIs), full CRM, suitability report generation

---

## 1. Why now

- ComplyVault's live pipeline has already surfaced the demand signal: the **email capture gap** was raised as a direct objection in the Secure Investment Management demo (Janice Powell, June 2026). This MVP answers it.
- SEC Rule 204-2 requires advisers to retain written communications relating to advice, recommendations, securities transactions and performance. Off-channel communications enforcement has produced $63M+ in combined settlements (Jan 2025) — a hot trigger event for the outbound engine.
- 2025 SEC exam priorities explicitly cover AI usage in advisory/compliance operations — reinforcing the product principle below.
- Every partner conversation (outsourced CCOs, compliance consultants) becomes stronger when ComplyVault produces an **exam-ready evidence bundle**, not just meeting documentation.

**Positioning (unchanged, non-negotiable):** Built for the CCO, not the advisor. This MVP extends the audit-pack layer from meetings to communications. Do not drift toward advisor productivity framing.

---

## 2. Product principles

1. **Every product creates or consumes an EvidenceItem.** The EvidenceItem is the atomic unit of the platform. Meetings, emails, messages, policies, attestations — all normalise to it.
2. **Route attention, not retention.** AI classifies, flags, explains and routes. It never suppresses, deletes or hides documentation, and never makes final compliance decisions. A human reviewer approves, dismisses or escalates — always.
3. **Tamper-evident by default.** Content hashing + hash-chained audit log on every EvidenceItem. This closes the missing P0 flagged in earlier reviews and is a demo differentiator ("chain of custody").
4. **Controlled ingestion, not total archive.** ComplyVault is not Smarsh/Global Relay. Sync selected mailboxes, folders and date ranges. The promise is "find and evidence what matters in a review", not "archive everything forever".
5. **Explainable AI.** Every classification stores the model, prompt version, confidence, and a plain-English rationale. This directly answers the AI-transparency objection raised in pipeline conversations.

---

## 3. Personas & jobs-to-be-done

| Persona                                    | Role                 | JTBD                                                                                    |
| ------------------------------------------ | -------------------- | --------------------------------------------------------------------------------------- |
| In-house CCO (small/mid RIA, $50M–$2B AUM) | Primary buyer        | "When the SEC sends a request list, produce a clean evidence pack in hours, not weeks." |
| Outsourced/fractional CCO                  | Partner + power user | "Review communications risk across 20–50 client firms without adding headcount."        |
| Compliance consultant / ex-regulator       | Validator            | "Trust the chain of custody and see exactly what the AI flagged and why."               |
| Adviser / IAR (dual-hatted)                | Passive contributor  | "Don't change my workflow. My mailbox is connected; that's it."                         |
| Firm admin                                 | Operator             | "Connect mailboxes, manage users, run exports."                                         |

---

## 4. Module A — Core Evidence Layer (foundation refactor)

### Goal

Generalise the existing data model so any artefact — meeting documentation, email, message, policy, attestation, uploaded file — is an **EvidenceItem** with uniform tagging, classification, review, retention, audit and export behaviour.

### What already exists (reuse, don't rebuild)

- Multi-layer CCO sign-off workflow → becomes the ReviewCase engine for all evidence types
- Compliance Cockpit UI shell (brand: DARK_GREEN `#0D2818`, ACCENT_GREEN `#2ECC71`)
- Firm onboarding via CRD auto-population (sec-api.io)
- Zoho One CRM integration (EU DC, zohoapis.eu) → client/contact matching source

### User stories

- **A1.** As a CCO, I can see every piece of evidence for a client in one chronological timeline, regardless of source (meeting, email, message, document), so I can reconstruct the advice narrative.
- **A2.** As a CCO, I can tag any EvidenceItem with compliance categories (advice, recommendation, complaint, fee, performance, marketing, review, vulnerable client) and filter/search by tag.
- **A3.** As a compliance reviewer, I can see a tamper-evident audit trail (create, view, tag, review, export, retention events) for any item, with hash verification.
- **A4.** As an admin, I can assign retention categories, and the system computes destruction-eligible dates (SEC baseline: 5 years, first 2 easily accessible).
- **A5.** As any user, my access is scoped by role: Admin, CCO/Reviewer, Adviser (own clients only), External Consultant (read + review on assigned firms).
- **A6.** As a CCO, I can run keyword + semantic search across all evidence in my firm and export any result set as a bundle.

### Acceptance criteria

- A single `EvidenceItem` table backs meetings, emails, messages, documents, policies, attestations via `source_type` + polymorphic detail tables.
- Existing meeting-documentation records are migrated onto EvidenceItem with zero data loss (write a migration + verification script).
- Every mutation writes an `AuditLog` row containing `prev_hash` and `row_hash` (SHA-256 chain per firm). A `verify-chain` job validates integrity nightly.
- Content files store a `content_sha256` computed at upload; re-download verifies hash.
- Search returns results in <2s for a firm with 100k items (pgvector for semantic, Postgres FTS for keyword).

---

## 5. Module B — Email Integration (Microsoft 365 / Outlook first)

### Goal

Controlled ingestion of firm/adviser mailboxes into the evidence layer. Gmail is fast-follow, not MVP.

### User stories

- **B1.** As an admin, I can connect a Microsoft 365 tenant via OAuth (Graph API, application or delegated consent) and select which mailboxes are in scope.
- **B2.** As an admin, I can scope ingestion by folder and date range per mailbox (e.g. "Inbox + Sent, from Jan 2024").
- **B3.** As the system, I ingest full threads with attachments, preserving headers, participants, timestamps and message IDs; deduplicate by internet message ID.
- **B4.** As the system, I match participants to Clients (via Zoho contacts + local client records) and to Users (advisers), and mark unmatched external addresses for triage.
- **B5.** As a CCO, I can view an email thread in a clean reader with attachments inline, tag it, open a ReviewCase from it, or add it to an ExamPack.
- **B6.** As a CCO, I can export any thread or selection as PDF + native EML/ZIP with a manifest (hashes, sources, custody).

### Ingestion flow (MVP)

1. Connect tenant → 2. Select mailboxes/folders/date range → 3. Backfill job (paged, resumable) → 4. Incremental sync via Graph delta queries (polling MVP; webhooks later) → 5. Each message → EvidenceItem + Communication + Attachments → 6. Auto-classification queued (Module C).

### Acceptance criteria

- OAuth tokens encrypted at rest; least-privilege Graph scopes (`Mail.Read` per approved mailbox); admin consent flow documented for IT-managed tenants.
- Backfill of a 10k-message mailbox completes without manual intervention and is resumable after failure.
- Thread grouping is correct across replies/forwards (conversationId + references fallback).
- Client matching precision >95% on exact address match; fuzzy matches always land in a triage queue, never auto-linked.
- No email content is sent to any third-party AI provider without the classification pipeline's redaction step (see Module C).

---

## 6. Module C — Email Compliance Audit

### Goal

Turn the archive into the sellable product: AI classification, risk scoring, and a human review queue.

### Classification taxonomy (v1)

| Category                 | Example signals                                              |
| ------------------------ | ------------------------------------------------------------ |
| Advice / recommendation  | "you should invest", "I recommend", "move your pension/401k" |
| Performance claims       | "will outperform", "guaranteed", "safe return"               |
| Fees / service scope     | fee promises, unclear ongoing service scope                  |
| Complaint                | "unhappy", "misled", "not suitable", "complain"              |
| Vulnerability indicators | bereavement, illness, confusion, financial distress          |
| Off-channel risk         | "text me", "WhatsApp me", "sent from my personal email"      |
| Marketing / promotion    | testimonial, promotional claims needing review               |
| Service evidence         | review offered/declined/completed, follow-up missing         |

### User stories

- **C1.** As the system, I classify every ingested communication with categories, a 0–100 risk score, confidence, and a plain-English rationale, storing model + prompt version.
- **C2.** As a CCO, I see a review queue sorted by risk, filterable by category, adviser, client and date; each item shows the AI rationale and the underlying thread.
- **C3.** As a reviewer, I can approve, dismiss (with reason), or escalate; escalation creates a Finding with status, owner, notes and remediation record.
- **C4.** As a CCO, I can tune sensitivity per category (thresholds) — but I can never disable capture or delete classifications ("route attention, not retention").
- **C5.** As a CCO, I can see per-adviser and per-client flag summaries (the seed of the future Supervision Cockpit — single-firm view only in MVP).

### AI pipeline requirements

- Two-stage: cheap heuristic/keyword pre-filter → LLM classification on candidates + random sample of non-candidates (to measure false-negative rate).
- PII-minimising prompt construction; log every prompt/response pair for auditability (this is itself evidence of AI governance — sellable under 2025 exam priorities).
- Human-review outcomes feed an evaluation set; track precision/recall per category from day one.

### Acceptance criteria

- Reviewer can clear a 50-item queue in a single session without page reloads; every action writes to the audit chain.
- Dismiss requires a reason code; nothing is deletable.
- Classification cost per 1k emails is measured and logged (unit economics for pricing).

---

## 7. Module D — ExamPack Generator

### Goal

The demo-winning feature: produce a clean, indexed, sign-off-approved evidence bundle against an exam request list in minutes.

### User stories

- **D1.** As a CCO, I can create an ExamPack from a template request list (SEC exam categories: books & records, communications, marketing, code of ethics, annual review) or build a custom list.
- **D2.** As a CCO, I can attach any EvidenceItems (meetings, emails, messages, documents, findings) to each request line, with AI-suggested candidates ranked by relevance.
- **D3.** As the system, I generate a per-request AI summary of what the attached evidence shows — clearly labelled as a draft for reviewer approval.
- **D4.** As a CCO, I see a gaps report: request lines with no evidence, weak evidence, or unresolved Findings.
- **D5.** As a reviewer, I sign off each section (reusing the existing multi-layer sign-off workflow) before export is unlocked.
- **D6.** As a CCO, I export a ZIP + index PDF: table of contents, per-item source, dates, owners, reviewer, content hash — a full chain-of-custody manifest.

### Acceptance criteria

- A pack with 200 items exports in <5 minutes with a deterministic, verifiable manifest.
- Export is blocked until all sections have reviewer sign-off (override requires Admin + logged reason).
- Demo path: seed firm → pre-loaded request list → attach evidence → gaps report → export, in under 10 minutes live.

---

## 8. Module E — Message Audit, Phase 1 (manual upload only)

### Goal

Cover off-channel evidence for exams without building connectors.

### Supported imports (v1)

| Source               | Format            | Parser                                                       |
| -------------------- | ----------------- | ------------------------------------------------------------ |
| WhatsApp export      | TXT / ZIP         | Line-format parser (timestamps, senders, media placeholders) |
| SMS export           | CSV / TXT         | Column-mapped importer                                       |
| Teams / Slack export | HTML / CSV / JSON | Best-effort structured parser                                |
| Screenshots / PDFs   | Image / PDF       | Stored as documents; OCR deferred                            |

### User stories

- **E1.** As a CCO, I can upload a message export, map senders to Users/Clients, and see parsed threads in the same reader UX as email.
- **E2.** As the system, imported messages run through the same classification pipeline (Module C) with an `off-channel` source flag.
- **E3.** As a CCO, I maintain an approved/prohibited channel register and log any discovered off-channel communication as an Exception with a remediation workflow (upload → classify → review → outcome).
- **E4.** As an admin, I can run quarterly staff attestations ("I have not used unapproved channels"), stored as EvidenceItems and exportable into ExamPacks.

### Acceptance criteria

- WhatsApp TXT export (the messiest format) parses ≥95% of messages correctly on a 1k-message test file; unparsed lines are preserved raw, never dropped.
- Every import records original file + hash; parsed messages link back to source file (custody).
- Product copy never promises capture of personal messages — the promise is "a defensible supervision and evidence workflow for approved and off-channel sources".

---

## 9. Database schema (Postgres / Prisma-style)

```prisma
model Firm {
  id              String   @id @default(uuid())
  name            String
  crdNumber       String?  @unique
  secStatus       String?          // from sec-api.io onboarding
  createdAt       DateTime @default(now())
  users           User[]
  clients         Client[]
  evidenceItems   EvidenceItem[]
  retentionRules  RetentionRule[]
  channelRegister ChannelRegisterEntry[]
}

model User {
  id        String   @id @default(uuid())
  firmId    String
  firm      Firm     @relation(fields: [firmId], references: [id])
  email     String
  name      String
  role      Role     // ADMIN | CCO_REVIEWER | ADVISER | EXTERNAL_CONSULTANT
  isActive  Boolean  @default(true)
  aliases   EmailAlias[]     // adviser matching across addresses
}

model Client {
  id         String  @id @default(uuid())
  firmId     String
  name       String
  zohoId     String?          // Zoho One contact link (EU DC)
  status     ClientStatus     // CLIENT | PROSPECT | FORMER
  emails     EmailAlias[]
  items      EvidenceItem[]
}

model EmailAlias {
  id        String  @id @default(uuid())
  address   String
  userId    String?
  clientId  String?
  verified  Boolean @default(false)   // fuzzy matches stay false until triaged
  @@unique([address, userId, clientId])
}

// ─── The atomic unit ────────────────────────────────────────────
model EvidenceItem {
  id             String        @id @default(uuid())
  firmId         String
  clientId       String?
  createdById    String?
  sourceType     SourceType    // MEETING | EMAIL | MESSAGE | DOCUMENT | POLICY | ATTESTATION | NOTE | FINDING_RECORD
  title          String
  occurredAt     DateTime      // when the underlying event happened
  ingestedAt     DateTime      @default(now())
  contentSha256  String
  storageUri     String?       // object storage pointer (immutable bucket)
  retentionRuleId String?
  destructionEligibleAt DateTime?
  tags           EvidenceTag[]
  classifications AIClassification[]
  reviewCases    ReviewCase[]
  packItems      ExamPackItem[]
  communication  Communication?      // populated when sourceType = EMAIL | MESSAGE
  @@index([firmId, clientId, occurredAt])
  @@index([firmId, sourceType])
}

model EvidenceTag {
  id       String @id @default(uuid())
  itemId   String
  item     EvidenceItem @relation(fields: [itemId], references: [id])
  category TagCategory  // ADVICE | RECOMMENDATION | COMPLAINT | FEE | PERFORMANCE | MARKETING | REVIEW | VULNERABLE_CLIENT | OFF_CHANNEL
  addedBy  String       // userId or "AI"
  addedAt  DateTime @default(now())
}

// ─── Communications ─────────────────────────────────────────────
model CommunicationThread {
  id             String  @id @default(uuid())
  firmId         String
  channel        Channel // EMAIL_M365 | WHATSAPP_IMPORT | SMS_IMPORT | TEAMS_IMPORT | SLACK_IMPORT | OTHER_IMPORT
  externalThreadId String?   // Graph conversationId etc.
  subject        String?
  participants   Json     // [{address, userId?, clientId?}]
  messages       Communication[]
}

model Communication {
  id              String  @id @default(uuid())
  threadId        String
  thread          CommunicationThread @relation(fields: [threadId], references: [id])
  evidenceItemId  String  @unique
  evidenceItem    EvidenceItem @relation(fields: [evidenceItemId], references: [id])
  direction       Direction    // INBOUND | OUTBOUND | INTERNAL
  sentAt          DateTime
  fromAddress     String
  toAddresses     String[]
  ccAddresses     String[]
  internetMessageId String?  @unique   // dedupe key for email
  bodyText        String       // plaintext extraction; original stored at storageUri
  attachments     Attachment[]
}

model Attachment {
  id              String @id @default(uuid())
  communicationId String
  filename        String
  mimeType        String
  contentSha256   String
  storageUri      String
}

model MailboxConnection {
  id            String   @id @default(uuid())
  firmId        String
  provider      Provider // M365 (Gmail later)
  mailboxAddress String
  scopeFolders  String[] // selected folders
  backfillFrom  DateTime?
  status        SyncStatus // PENDING | BACKFILLING | ACTIVE | ERROR | DISCONNECTED
  encryptedToken String    // envelope-encrypted
  deltaCursor   String?    // Graph delta token
  lastSyncAt    DateTime?
}

model IngestJob {
  id         String @id @default(uuid())
  connectionId String?
  importFileId String?
  kind       JobKind   // BACKFILL | DELTA | MESSAGE_IMPORT
  status     JobStatus // QUEUED | RUNNING | PAUSED | DONE | FAILED
  cursor     String?
  stats      Json      // counts, errors
}

model MessageImportFile {
  id            String @id @default(uuid())
  firmId        String
  uploadedById  String
  sourceFormat  ImportFormat // WHATSAPP_TXT | SMS_CSV | TEAMS_HTML | SLACK_JSON | RAW_DOC
  originalSha256 String
  storageUri    String
  parseStats    Json
}

// ─── AI & review ────────────────────────────────────────────────
model AIClassification {
  id             String @id @default(uuid())
  evidenceItemId String
  item           EvidenceItem @relation(fields: [evidenceItemId], references: [id])
  category       TagCategory
  riskScore      Int          // 0–100
  confidence     Float
  rationale      String       // plain-English explanation
  modelId        String
  promptVersion  String
  createdAt      DateTime @default(now())
  humanOutcome   ReviewOutcome? // set when reviewed — feeds eval set
}

model ReviewCase {
  id             String @id @default(uuid())
  firmId         String
  evidenceItemId String
  openedById     String       // user or "SYSTEM"
  assignedToId   String?
  status         CaseStatus   // OPEN | APPROVED | DISMISSED | ESCALATED
  dismissReason  String?      // required when DISMISSED
  notes          Note[]
  finding        Finding?
  signOffs       SignOff[]    // reuses existing multi-layer sign-off engine
}

model Finding {
  id           String @id @default(uuid())
  reviewCaseId String @unique
  severity     Severity // LOW | MEDIUM | HIGH
  summary      String
  status       FindingStatus // OPEN | REMEDIATING | RESOLVED
  remediation  Json          // steps, owner, dates
}

// ─── ExamPack ───────────────────────────────────────────────────
model ExamPack {
  id        String @id @default(uuid())
  firmId    String
  title     String
  status    PackStatus // DRAFT | IN_REVIEW | SIGNED_OFF | EXPORTED
  requests  ExamRequest[]
  exportManifestSha256 String?
}

model ExamRequest {
  id        String @id @default(uuid())
  packId    String
  pack      ExamPack @relation(fields: [packId], references: [id])
  refCode   String   // e.g. "II.A.3"
  title     String
  aiSummary String?  // draft, requires sign-off
  signOffId String?
  items     ExamPackItem[]
}

model ExamPackItem {
  id             String @id @default(uuid())
  requestId      String
  evidenceItemId String
  addedById      String
  relevanceNote  String?
  @@unique([requestId, evidenceItemId])
}

// ─── Off-channel governance ─────────────────────────────────────
model ChannelRegisterEntry {
  id       String @id @default(uuid())
  firmId   String
  channel  String        // "Email (M365)", "Personal WhatsApp", ...
  status   ChannelStatus // APPROVED | PROHIBITED
  policyId String?
}

model OffChannelException {
  id             String @id @default(uuid())
  firmId         String
  discoveredVia  String   // "email flag", "attestation", "import"
  evidenceItemId String?
  reviewCaseId   String?
  outcome        String?
}

model Attestation {
  id             String @id @default(uuid())
  firmId         String
  userId         String
  period         String   // "2026-Q3"
  statement      String
  attestedAt     DateTime?
  evidenceItemId String   @unique  // attestations ARE evidence
}

// ─── Retention & audit ──────────────────────────────────────────
model RetentionRule {
  id        String @id @default(uuid())
  firmId    String
  category  String
  years     Int     // SEC 204-2 baseline: 5
  hotYears  Int     // easily accessible period: 2
}

model AuditLog {
  id        String   @id @default(uuid())
  firmId    String
  actorId   String   // userId or "SYSTEM"
  action    String   // CREATE | VIEW | TAG | CLASSIFY | REVIEW | EXPORT | RETENTION_EVENT ...
  entity    String
  entityId  String
  payload   Json
  at        DateTime @default(now())
  prevHash  String   // hash chain per firm
  rowHash   String   // sha256(prevHash + canonical(payload))
  @@index([firmId, at])
}
```

**Architecture notes**

- Postgres + pgvector (semantic search) + FTS (keyword). Object storage with versioning/immutability for raw content (S3 Object Lock or equivalent) — this plus the hash chain delivers tamper-evidence.
- Queue-based ingestion + classification workers (BullMQ or equivalent); everything resumable.
- Multi-tenant row-level scoping by `firmId` on every query (middleware-enforced).
- Frontend: existing Compliance Cockpit shell (React/TS), brand tokens DARK_GREEN `#0D2818` / ACCENT_GREEN `#2ECC71`.

---

## 10. Build phases

Sequenced for a solo builder with a live sales pipeline; each phase ends demo-able.

### Phase 1 — Evidence spine (Weeks 1–3)

- EvidenceItem model + migration of existing meeting docs
- Tagging, roles, retention fields, timeline view per client
- Hash-chained AuditLog + nightly verify job + immutable storage
- Keyword search (semantic can slip to Phase 3)
- **Exit demo:** upload documents, tag, view client timeline, show custody trail

### Phase 2 — Outlook integration (Weeks 4–7)

- M365 OAuth + mailbox/folder/date scoping
- Backfill + delta sync jobs, thread grouping, attachment capture
- Client/adviser matching + triage queue (Zoho + local)
- Thread reader UI, manual tagging, thread export (PDF/EML+manifest)
- **Exit demo:** connect a mailbox live, watch threads land in the vault — _this is the direct answer to the Janice Powell objection_

### Phase 3 — AI email audit (Weeks 8–10)

- Two-stage classification pipeline, taxonomy v1, risk scores + rationales
- Review queue with approve/dismiss/escalate + Findings
- Per-adviser / per-client flag summaries (single-firm dashboard seed)
- Prompt/response logging + eval set from reviewer outcomes
- **Exit demo:** 500-email seed mailbox → queue of ranked risks → reviewer workflow

### Phase 4 — ExamPack (Weeks 11–12)

- Request-list templates + custom lists
- Evidence attach + AI-suggested candidates + gaps report
- AI section summaries behind existing sign-off workflow
- ZIP + index PDF export with chain-of-custody manifest
- **Exit demo:** the 10-minute "request list → export" flow — lead partner demos with this

### Phase 5 — Message audit v1 (Weeks 13–14)

- WhatsApp TXT parser first, then SMS CSV; Teams/Slack best-effort
- Sender mapping, same classification pipeline, off-channel flag
- Channel register + exception log + quarterly attestations
- Import into ExamPacks
- **Exit demo:** upload WhatsApp export → flagged advice messages → exception remediation → evidence in pack

---

## 11. Success metrics

| Metric                                                   | Target                                                                      |
| -------------------------------------------------------- | --------------------------------------------------------------------------- |
| Mailbox connect → first classified thread                | < 30 minutes                                                                |
| Reviewer throughput                                      | 50 items / session without friction                                         |
| Classification precision (advice + complaint categories) | > 85% by end of Phase 3, measured against reviewer outcomes                 |
| ExamPack build time (200 items)                          | < 1 day of CCO effort; export < 5 min                                       |
| Pilot conversion signal                                  | ≥ 1 partner (outsourced CCO) running a live pilot mailbox by end of Phase 3 |

---

## 12. Risks & mitigations

| Risk                                              | Mitigation                                                                                                        |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Graph API consent friction at IT-managed firms    | Delegated-consent fallback per mailbox; admin-consent guide as sales collateral                                   |
| AI false negatives create liability optics        | Random-sample auditing of non-flagged mail; never market as "catches everything" — market as supervision workflow |
| Scope creep toward full archiving                 | Hard MVP boundary: selected mailboxes/folders/date ranges only                                                    |
| Solo-founder bandwidth vs pipeline demands        | Each phase exits demo-able; sell Phase 2 output while building Phase 3                                            |
| Data residency questions (UK company, US clients) | Choose US region storage for US firms from day one; document in security one-pager                                |

---

## 13. Sales alignment (build ↔ pipeline)

- **Janice Powell (SIM):** Phase 2 exit demo directly answers her email-capture objection; Phase 3 rationale-logging answers her AI-transparency objection; sign-off-gated ExamPack answers sign-off liability.
- **Lori Weston (STP):** ExamPack + gaps report is the consultant-facing hook — evidence her clients' exam readiness faster.
- **Blake Bjordahl (RIA Compliance Technology):** his stack has Simple Email Archive but no meeting documentation — position ComplyVault as the documentation + exam-pack layer that _complements_ his archive; integration conversation, not competition.
- **Bryan Hill / Kent Keister / Andrew Schuster:** ExamPack demo is the partner-programme opener; multi-firm Supervision Cockpit is the retention hook for the Certified Partner tier (post-MVP).
