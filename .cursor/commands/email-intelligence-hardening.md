# Harden Email Intelligence — close the four known gaps

Email Intelligence shipped behind the `emailIntelligence` flag: polymorphic Flag, `EvidenceClassification`, `ClientActivity`, `EvidenceItem.searchableText`, Ask ComplyVault over email with structural citations. 123 tests passing. This command closes the four gaps noted at completion. Work them in the order below: correctness first, reliability second, small UI third, retrieval quality last.

## Ground rules

- Same rules as the original epic: reuse the existing component library (`AnswerCard`, `Badge`, `CommandDialog`, `FlagTriageCard`, `Table`, dashboard table patterns), redaction guard before any LLM call, workspace scoping on every query, no em dashes in user-facing copy.
- Complete each phase, run the full suite plus typecheck, stop and summarise before the next phase.
- No destructive migrations. Every migration must be additive or backfill-then-switch. State explicitly in each phase summary whether the migration is safe to run on a database with live data.

---

## Phase 1 — Replace name-matching of meetings to Client rows (correctness bug)

The dashboard/client merge currently matches meetings to `Client` rows by name string. This silently misattributes on nicknames, "Robert & Susan Calloway" vs "Robert Calloway", duplicate names across households, and renames.

- Add a real relation: `Meeting.clientId` (nullable FK to Client), following existing FK conventions.
- Backfill job:
  - Pass 1: match via meeting participants' email addresses against `EmailAddress`/household records (the Phase-1 resolver from the original epic). This is authoritative.
  - Pass 2: for meetings with no participant emails, fall back to exact normalised name match, but write these with a `matchConfidence` marker (enum or float, follow conventions).
  - Anything unmatched or ambiguous goes to a reviewable list, not a guess.
- Update every dashboard and client-page query to join on `clientId` and delete the name-matching code path entirely once backfill completes. Grep for the old matcher and list every call site removed.
- Surface low-confidence and unmatched meetings somewhere a user can fix them: reuse the participant triage pattern (a "needs attribution" section using the existing triage components). Resolving one sets `clientId` and clears the marker.
- Tests: nickname mismatch, two clients sharing a name in different workspaces, meeting with participants from two households (must go to review, not auto-attach), rename of a client after backfill.

## Phase 2 — Move classification off the ingest path (reliability)

Classification currently runs inline on ingest. A slow or failing LLM call must never block or fail mail sync.

- Move classification to the project's existing QStash job pattern (find and follow how other background jobs are defined, signed, and verified; do not invent a new pattern).
- Ingest writes the evidence item, participant matches, and `ClientActivity`, then enqueues a classification job with the evidence item id only. The job re-reads content server-side; never put email content in the queue payload.
- Idempotency: the job must be safe to deliver twice (guard on existing `EvidenceClassification` for that evidence item + prompt version).
- Failure handling: retries per the existing QStash config; after final failure, record a `CLASSIFICATION_FAILED` state on the evidence item and surface a count of unclassified items somewhere a CCO can see coverage is incomplete (reuse an existing badge/alert component on the Communications or dashboard surface). Silent gaps in supervision coverage are an audit finding; failure must be visible.
- Add a small "reclassify" action (existing button/menu component) for failed items.
- Tests: duplicate delivery creates one classification; LLM failure marks the item failed and does not fail ingest; reclassify succeeds after a failure.

## Phase 3 — Household CRUD UI (small)

The household model exists from Phase 1 of the original epic but has no management UI.

- On the client detail page, add a Household section: list members (name, relationship label, email addresses), add member, edit, remove, and link/unlink an existing client record as a household member. Compose entirely from existing form, table, and dialog components.
- Adding an email address here must trigger the retroactive thread-attachment behaviour the resolver already supports; show the same "N historical threads will be attached" confirmation used in triage.
- Removing an address or member must NOT detach historical correspondence (evidence is immutable); it only stops future matching. Make this explicit in the confirmation copy.
- Permissions: follow whatever role gating exists for client editing.
- Tests: add address → retroactive attach; remove member → history intact, future mail unmatched.

## Phase 4 — Semantic retrieval with pgvector (quality, both sources)

Ask ComplyVault currently ranks by keyword for both meetings and email. Upgrade to hybrid retrieval, generically for both sources.

- Infra check first: confirm the Postgres provider supports the `vector` extension and state what you found. If it cannot be enabled, stop and propose the fallback (managed embedding search or SQLite-vec style alternative consistent with the stack) instead of building around it.
- Schema: `EvidenceEmbedding` table (evidence item id or chunk id, workspace id, source type, vector, model + version, created at). Chunk per message for email and per transcript segment for meetings, consistent with how `searchableText` is derived. Embed redacted text only, via the existing redaction guard.
- Backfill: a resumable job (QStash, per Phase 2 pattern) embedding existing evidence in batches, with progress recorded so it can restart. New ingests embed in the classification job (one queue hop, not two).
- Retrieval: hybrid score combining the existing keyword ranker with cosine similarity (keep the keyword path as a component of ranking, not deleted; exact names and identifiers must still win). Workspace filter applied in SQL before similarity ordering, never post-filtered in application code.
- Citations behaviour is unchanged: structural citations with thread/meeting id, hash, deep link. If hybrid retrieval returns nothing above threshold, keep the explicit "No matching correspondence found in your workspace." response.
- Evaluation gate: before swapping the ranker in, run the existing seed queries plus ten new paraphrase queries (e.g. "anyone unhappy about what we charge" must find fee-complaint threads) against both rankers and report side-by-side results. Swap only if hybrid is equal or better on every seed query.
- Tests: workspace isolation at the SQL level, threshold behaviour, backfill resumability, prompt-version/model-version recorded per embedding.

---

## Final checks

- Full suite + typecheck.
- Confirm the four gaps are closed and list any new gaps introduced.
- State migration order and whether each is safe against live data, so deploy can be staged.
