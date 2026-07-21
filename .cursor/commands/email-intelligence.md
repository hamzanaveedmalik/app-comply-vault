# Implement Email Intelligence (EPIC-C + Client Correspondence + Ask ComplyVault for Email)

You are implementing three connected features on top of the existing, working Gmail/M365 ingest pipeline. Email threads are already stored as evidence (EMAIL source type, MIME + SHA-256) with participant matching and an unmatched-sender triage queue. Classification is currently a stub: `enqueueClassification` redacts content for LLM use and adds an in-memory key, but calls no LLM, creates no flags, and never surfaces email in the Review Queue. Flags are currently meeting-scoped.

Your job: make email a first-class evidence source with the SAME machinery meetings use. Do not build a parallel pipeline. Do not invent new UI primitives.

## Ground rules (read before writing any code)

1. **Discovery first.** Before implementing anything, read and summarise back to me:
   - The Prisma/DB schema for Meeting, Flag, Communication (or the email thread model), Participant, Client, Workspace, and the Review Queue / audit pack models.
   - The meeting extraction pipeline end to end: where the transcript goes in, which service calls the LLM, how flags are created, how they enter the Review Queue, how dispositions work, and how the audit pack assembles.
   - The `enqueueClassification` stub and its redaction path.
   - The component library used across the app (tables, badges, status pills, timeline/list components, drawer/sheet, empty states, filters). List the components by name and where they live. Every screen you build must be composed from these.
     Stop and present this summary before Phase 1. Wait for my approval.

2. **Reuse over creation.** New UI must be assembled from the existing component library. If a needed primitive genuinely does not exist, flag it and propose the closest existing component instead of writing a new one.

3. **Redaction before LLM, always.** All email content sent to any LLM must pass through the existing redaction path already present in the stub. No raw PII to the model.

4. **Workspace scoping.** Every query, every retrieval, every LLM context assembly is scoped to the current workspace. Treat cross-workspace leakage as a P0 bug.

5. **Feature flag everything.** Put all three phases behind a single `emailIntelligence` feature flag (follow whatever flag pattern the project already uses) so the AdvizorStack demo environment and production can diverge safely.

6. **Work phase by phase.** Complete a phase, run the checks, stop, and summarise what changed before starting the next. Do not attempt all three phases in one pass.

7. **No em dashes in any user-facing copy.**

---

## Phase 1 — Client correspondence: the system knows who Robert Calloway is

**Goal:** a synced email from or to a matched client visibly updates that client's record without any manual step.

### Backend

- Harden entity resolution on ingest:
  - Match on any known email address for the client OR their linked household members (spouse, joint account holder). Support multiple addresses per person; add an `EmailAddress` join model if one does not exist rather than widening a single column.
  - When a thread has a mix of matched and unmatched participants, attach the thread to the matched client AND still queue the unknown addresses for triage.
  - When triage resolves an unknown address to a client, retroactively attach that address's existing threads to the client.
- On successful match, write a correspondence event to whatever activity/timeline model the client record uses (create one following existing model conventions only if none exists).
- Update client-level aggregates: last contact date (max of last meeting, last email), correspondence count in the current period.

### Frontend (existing components only)

- Client detail page: add a Correspondence section using the same list/timeline component the meeting history uses. Each row: direction (sent/received), counterparties, subject, date, evidence-hash indicator, link to the full thread in Communications.
- Clients table on the dashboard: LAST MEETING column becomes LAST ACTIVITY (meeting or email, whichever is latest), with a small icon distinguishing the type. Reuse the existing table cell patterns.
- Triage queue: when resolving an unknown sender, the confirmation state shows how many historical threads will be attached.

### Acceptance

- Send a test email from a matched address → thread appears on the client's Correspondence section and Communications, client's last activity updates, no manual action.
- Send from an unknown address → lands in triage; resolving it attaches the thread and any earlier threads from that address.
- Unit tests for the resolver covering: multi-address clients, household members, mixed matched/unmatched threads, retroactive attachment.

---

## Phase 2 — EPIC-C: CCO audit prep for email (the core of this work)

**Goal:** email flows through the SAME classify → flag → Review Queue → disposition → audit pack lifecycle as meetings.

### Schema: make flags source-agnostic

- Refactor Flag from meeting-scoped to polymorphic source. Preferred shape (adapt to project conventions): `sourceType` enum (`MEETING`, `EMAIL`) + `sourceId`, with a migration that backfills existing flags as `MEETING`. Keep a relation to Communication for email-sourced flags so joins stay ergonomic.
- Audit every existing query/component that assumes `flag.meetingId` and update it. List them all in your phase summary.

### Classification

- Replace the `enqueueClassification` stub with a real pipeline call:
  - Reuse the meeting extraction service (same LLM client, same retry/queue infrastructure). Add an email-specific prompt/taxonomy, not a new service.
  - Email flag taxonomy (v1): promissory or guaranteed-return language; performance claims; client complaint or expression of dissatisfaction; unapproved marketing content; instruction or trade request received by email; fee dispute; reference to off-channel communication ("text me", "WhatsApp me", personal number exchange); sharing of credentials or sensitive PII; gifts and entertainment mentions.
  - Each classification result stores: category, severity, confidence, the redacted excerpt that triggered it, and a pointer to the exact message within the thread.
  - Threads classified clean get an explicit `CLEAN` result recorded (reviewed-and-clean is itself audit evidence; mirror how clean meetings are recorded).
- Idempotency: re-syncing a thread must not duplicate classifications or flags.

### Review Queue and dispositions

- Email-sourced flags appear in the existing Review Queue alongside meeting flags, using the same card/row components, with a source badge (reuse the existing badge component).
- Dispositions (resolve / dismiss / escalate) work identically, including rationale capture and whatever write-backs meeting dispositions perform. Resolving should allow linking another communication or meeting as remediation evidence.

### Audit pack

- Add an Email Correspondence section to the audit pack / ExamPack generator: per client and date range, include thread metadata, SHA-256 hashes, classification results, flags with dispositions and rationale, and reviewer identity + timestamps. Follow the exact formatting conventions of the existing meeting sections.
- The manual thread ZIP export remains, but the pack section is the primary output.

### Acceptance

- Ingest a seeded thread containing a guaranteed-returns sentence → flag created with correct category, appears in Review Queue with EMAIL badge, dispositionable, appears in a generated audit pack with hash and rationale.
- Ingest a clean thread → CLEAN classification recorded, no flag, thread still listed in the pack's coverage summary.
- Re-sync the same mailbox → zero duplicate flags.
- All pre-existing meeting flag tests still pass after the schema migration.

---

## Phase 3 — Ask ComplyVault answers email questions

**Goal:** the existing Ask ComplyVault interface can answer questions over the connected mailbox, with citations, never uncited prose.

- Index redacted email content into the existing vector/RAG infrastructure (reuse whatever the meeting side uses; if meetings are not yet indexed, build the indexer generically for both sources rather than email-only). Chunk per message, metadata: workspace, client, thread id, message id, date, direction, classification category, hash.
- Retrieval is workspace-scoped and honours the user's role permissions.
- Answer synthesis MUST return citations: every claim links to the source thread/message and shows its evidence hash. If retrieval finds nothing, say so plainly; never answer from the model's general knowledge about a client.
- Wire into the existing Ask ComplyVault UI (the command-K / search bar surface). Reuse its existing result components; add a source chip for email results.
- Seed test queries for acceptance: "Show me every email where a client mentioned fees since April", "Has any advisor promised performance in writing?", "When did we last hear from Robert Calloway and about what?"

### Acceptance

- Each seed query returns cited results linking to real threads; clicking a citation opens the thread.
- A query about a client in another workspace returns nothing.
- An unanswerable query returns an explicit "no matching correspondence" response.

---

## Final checks (after Phase 3)

- Run the full test suite and typecheck.
- Grep for any remaining copy implying email audit is manual-only or M365-only; update it to reflect the new behaviour, gated on the feature flag.
- Produce a summary: schema migrations, new/changed endpoints, components reused (with names), anything you could not reuse and why, and known gaps deferred.
