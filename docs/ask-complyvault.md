# ComplyVault — Product Requirements Document

## Ask ComplyVault — LLM-Powered Meeting Q&A

| Field          | Value                                                                                                       |
| -------------- | ----------------------------------------------------------------------------------------------------------- |
| Feature ID     | CV-FEAT-014                                                                                                 |
| Status         | Draft (Phase 1 ready to build)                                                                              |
| Version        | 1.0                                                                                                         |
| Author         | Hamza Naveed, Founder & Owner/CCO                                                                           |
| Created        | 2 June 2026                                                                                                 |
| Target Release | Phase 1 (RAG over existing `searchableText`): 1 sprint · Phase 2 (semantic retrieval): post-pilot           |
| Depends On     | `Meeting.searchableText` index (Story 7.4) · `src/server/extraction/` LLM providers · `requireAppAccess`    |

---

## 0. Why This PRD Exists

The top-bar search field already says **"Ask ComplyVault…"** and prompts users with natural-language examples ("Did Rob discuss fee changes?", "Show suitability flags from last week"). Behind the scenes it is a substring lookup against `Meeting.clientName` and `Meeting.searchableText` — no language model, no synthesis, no citations. Users get back a meeting list, never an answer.

This PRD turns the existing button into what it already pretends to be: a question box that returns a grounded, cited answer about the workspace's meeting corpus, using infrastructure that already exists in the repo. **No new vector DB, no new schema migrations, no new auth model.** Phase 1 ships on the current stack.

---

## 1. Problem Statement

### 1.1 User Pain

- CCOs sitting at the dashboard need answers, not lists. "Did Sarah disclose the soft-dollar arrangement at the May review?" should return *yes/no + evidence*, not 12 meeting cards to click through.
- Existing keyword search misses paraphrases. A query for "fee hike" doesn't surface a transcript that says "moving you up to the 1.25% tier."
- The example queries in the search dialog (`Did Rob discuss fee changes?`) set an expectation the product currently does not honour — a credibility leak on every empty-state.
- Time-to-answer during an SEC exam matters. The examiner asks "show me where you disclosed conflicts at this meeting" — clicking through transcripts is slower than asking.

### 1.2 Why Now

- All LLM plumbing already exists: `src/server/extraction/{openai,anthropic,vertex}.ts`, env vars `OPENAI_API_KEY` / `OPENAI_MODEL` / `EXTRACTION_PROVIDER`, retry-with-backoff logic.
- `Meeting.searchableText` (Story 7.4) is already populated on every meeting — it concatenates transcript segments and all extracted fields, normalised and capped at 50KB. This is the retrieval index we need.
- The frontend (`src/components/global-search.tsx`) is already a `CommandDialog` with debounced input — we extend it, we don't rebuild it.
- Phase 1 cost is one new route handler + one new dialog mode. Days, not weeks.

---

## 2. Goals & Success Metrics

### 2.1 Goals

- Replace the dead "Ask ComplyVault…" framing with an actual conversational answer engine, grounded in the user's own meeting corpus.
- Preserve every compliance guarantee already in place: workspace isolation, audit trail, soft-delete respect, no PII in logs.
- Ship Phase 1 within one sprint without introducing pgvector, embeddings infra, or any new dependency beyond what's already in `package.json`.

### 2.2 Success Metrics

| Metric          | Target                                                                                                          |
| --------------- | --------------------------------------------------------------------------------------------------------------- |
| Latency         | p50 < 4s, p95 < 8s for a single answer (retrieval + LLM call combined)                                          |
| Grounding       | 100% of answers include at least one citation when meetings are found; "I don't have evidence" otherwise        |
| Workspace leak  | 0 cross-workspace results in red-team test (10 dual-tenant queries)                                             |
| Adoption        | ≥40% of weekly active users issue at least 1 question within 30 days of launch                                  |
| Audit integrity | 100% of LLM queries logged to `AuditEvent` with `action = AI_QUERY` (new enum value)                            |

---

## 3. Scope

### 3.1 In Scope — Phase 1 (RAG over `searchableText`)

- New route handler: `POST /api/ask` — accepts a natural-language question, returns a synthesised answer + meeting citations.
- New UI mode in the existing `GlobalSearch` dialog: "Ask" tab alongside existing keyword results, toggled by a leading `?` in the query or an explicit `[Ask]` chip.
- Retrieval: reuse `Meeting.searchableText` substring matching, expand to top-K meetings by recency + match count, build a compact context window from the matching meetings' transcript segments and extraction fields.
- Synthesis: call configured LLM provider (default OpenAI `gpt-4o-mini`) with a strict grounded-answer system prompt — model may only cite text it was shown, must say "I don't have evidence for that" when retrieval returns nothing relevant.
- Citations: every claim ties back to a `meetingId` (and optional transcript timestamp). UI renders meeting chips that deep-link to `/meetings/[id]`.
- Audit trail: new `AuditAction.AI_QUERY` enum value; every question logged with `workspaceId`, `userId`, query hash (not raw query — see §6.4), and retrieved `meetingId`s in metadata.
- Rate limit: per-user, per-workspace soft cap (10 questions/min) to keep LLM spend bounded.

### 3.2 In Scope — Phase 2 (Semantic Retrieval, Post-Pilot)

- pgvector extension on PostgreSQL, embedding column on `Meeting` (and on per-segment chunks for higher precision).
- Embedding generation on transcript finalisation (extend the existing extraction job).
- Hybrid retrieval: union of keyword (`searchableText`) and semantic (cosine similarity ≥ threshold) result sets, re-ranked by recency × score.
- Multi-turn follow-ups: short conversational thread persisted per session.

### 3.3 Out of Scope

- Cross-workspace queries. Always single-workspace. No exceptions.
- Generating new regulatory citations or SEC rule references. The model may **never** quote a CFR section that is not already present in the retrieved meeting text. This is a hard compliance rail (see §6.2).
- Automatic remediation actions ("close this flag"). Read-only Q&A only — any mutation is out of scope and out of the system prompt.
- Voice input. Text input only.
- Streaming the LLM response in Phase 1 (one-shot answer is fine for the targeted latency).
- Persisted chat history. Phase 1 is single-turn.

---

## 4. User Experience

### 4.1 Interaction Surface

The existing top-bar button (`src/components/global-search.tsx`) remains. Inside the dialog:

1. **Default keyword mode** (today's behaviour): user types `eman`, sees client matches and transcript snippets.
2. **Ask mode** (new): triggered when (a) the query ends in `?`, (b) the query starts with `ask:`, or (c) the user clicks the "Ask" chip rendered next to the input. The result list collapses into a single answer card.

The example chips on the empty state stay (`Did Rob discuss fee changes?`, `Show suitability flags from last week`) — clicking them now actually returns an answer.

### 4.2 Answer Card Anatomy

```
┌────────────────────────────────────────────────────────────────────┐
│  Q: Did Rob discuss fee changes at the May review?                 │
├────────────────────────────────────────────────────────────────────┤
│  Yes. In the meeting on May 14, Rob walked the client through      │
│  the move from the 1.00% to 1.25% tier, citing the new advisory    │
│  service bundle. The client acknowledged the change verbally.      │
│                                                                    │
│  Evidence:                                                         │
│  • Rob Cabrera — Quarterly Review — May 14 2026  [open ↗]          │
│      "…stepping you up to the 1.25 tier effective June 1…"         │
│  • Rob Cabrera — Suitability Check — May 28 2026  [open ↗]         │
│      "…confirmed you're comfortable with the new pricing…"         │
│                                                                    │
│  ⓘ Answered from 2 meetings in your workspace · 3.2s · gpt-4o-mini │
└────────────────────────────────────────────────────────────────────┘
```

When no evidence is found, the card reads:

> I don't have evidence for that in your meeting records. Try rephrasing, or check that the meeting has been finalised.

### 4.3 Loading & Error States

- Loading: spinner inside the card; placeholder text "Searching meetings… synthesising answer…" with rotating sub-text after 2s ("Reading transcripts…", "Checking flags and disclosures…") to keep perceived latency tolerable.
- Provider failure: card flips to "Couldn't generate an answer right now. The keyword results below may help." and falls back to the existing keyword result list. The user is not blocked.
- Rate limit: inline message "You've asked a lot of questions in the last minute — try again in 30s." No card rendered.

---

## 5. Technical Architecture

### 5.1 Stack Note — tRPC vs Route Handlers

The project rules (`.cursor/rules`) mandate tRPC for all server logic. The codebase, however, has **no tRPC dependency installed** and uses Next.js route handlers throughout (`/api/search/route.ts`, `/api/meetings/*`, etc.). To minimise surface area and ship in one sprint, **Phase 1 follows the codebase's actual pattern: a Next.js route handler with Zod input validation and the `requireAppAccess` guard.** Migrating the platform to tRPC is a separate (worthy) project and is out of scope here. Flagging this so the deviation is explicit, not accidental.

### 5.2 Endpoint: `POST /api/ask`

**File:** `src/app/api/ask/route.ts`

**Request:**

```ts
const AskRequestSchema = z.object({
  question: z.string().trim().min(3).max(500),
  // Optional: scope to a single meeting (used by meeting-detail "Ask about this meeting" CTA)
  meetingId: z.string().cuid().optional(),
  // Optional: time window in days, e.g. 30 = "last 30 days"; defaults to all
  windowDays: z.number().int().positive().max(365).optional(),
});
```

**Response (success):**

```ts
type AskResponse = {
  success: true;
  data: {
    answer: string;            // grounded prose, may contain "I don't have evidence…"
    citations: Array<{
      meetingId: string;
      clientName: string;
      meetingDate: string;     // ISO 8601
      snippet: string;         // up to 240 chars from the matched transcript/field
      transcriptStartSec?: number;
    }>;
    retrieval: {
      candidatesScanned: number;
      candidatesUsed: number;
      mode: "keyword";         // Phase 2 will add "hybrid" | "semantic"
    };
    model: string;             // resolved OPENAI_MODEL or provider equivalent
    latencyMs: number;
  };
};

type AskResponseError =
  | { success: false; error: "RATE_LIMITED"; retryAfterSec: number }
  | { success: false; error: "LLM_PROVIDER_ERROR"; message: string }
  | { success: false; error: "VALIDATION_ERROR"; issues: z.ZodIssue[] };
```

**Authorisation:** `requireAppAccess()` — same guard as every other app route. Returns 401/403/402 on failure.

### 5.3 Retrieval Pipeline (Phase 1)

```
question
   │
   ▼
[1] keyword extraction — drop stopwords, keep nouns/verbs, lowercase, dedupe
   │
   ▼
[2] Prisma query: Meeting.findMany({
       where: {
         workspaceId,                            // hard tenant boundary
         deletedAt: null,                        // soft delete respect
         status: { in: ["DRAFT_READY", "FINALIZED"] },  // skip in-flight
         ...(meetingId ? { id: meetingId } : {}),
         ...(windowDays ? { meetingDate: { gte: cutoff } } : {}),
         OR: keywords.map(k => ({
           searchableText: { contains: k, mode: "insensitive" }
         })),
       },
       select: { id, clientName, meetingDate, meetingType, transcript, extraction, searchableText },
       take: 12,
       orderBy: [{ meetingDate: "desc" }],
    })
   │
   ▼
[3] score each meeting:
      score = sum(keyword match count in searchableText) * recencyDecay(meetingDate)
    keep top 5
   │
   ▼
[4] for each kept meeting, extract up to 3 most-relevant transcript segments
    (segments whose text contains the most keywords; tie-break by recency in transcript)
    + the top-level extracted fields that match (topics, recommendations, disclosures)
   │
   ▼
[5] assemble context block (hard cap: 12,000 input tokens — leave headroom for prompt + answer)
```

**Why this is enough for Phase 1:** `searchableText` is already populated by `generateSearchableText()` in `src/server/search/index.ts` on every meeting that has a transcript + extraction. It includes topics, recommendations, disclosures, decisions, and follow-ups. Keyword overlap there is a strong-enough first-pass for the launch corpus (RIAs typically have hundreds, not millions, of meetings). Semantic retrieval (Phase 2) raises the ceiling but is not the floor.

### 5.4 LLM Call

**Provider:** reuse the abstraction in `src/server/extraction/` by adding a new method (or a sibling module `src/server/ask/`) that calls the same provider with a different prompt. Default OpenAI `gpt-4o-mini` (already configured). Retry with exponential backoff, max 2 retries (lower than extraction's 3 — this is interactive, not batch).

**System prompt (verbatim, demo-ready draft):**

```
You are ComplyVault, a compliance assistant for Registered Investment Advisors.

You answer questions ONLY about the meeting evidence provided to you below. Follow these
rules without exception:

1. NEVER invent facts. If the evidence does not answer the question, reply exactly:
   "I don't have evidence for that in your meeting records."

2. NEVER cite SEC rules, CFR sections, or external regulations. You may only quote
   text that appears in the evidence block.

3. Every factual claim in your answer must correspond to at least one of the meetings
   in the evidence. When you make a claim, mention the client name and meeting date
   inline (e.g. "On May 14 with Rob Cabrera, ...").

4. Keep answers under 120 words. Plain prose. No markdown headers, no bullet points
   unless the user explicitly asks for a list.

5. If the evidence is conflicting or ambiguous, say so plainly. Do not pick a side.

6. Never repeat or summarise the user's question.

Evidence is delimited by <evidence> tags. Each meeting has an id, client name, date,
meeting type, and excerpts.
```

**User message structure:**

```
<evidence>
[meeting:cl1xxx] Sarah Johnson · Quarterly Review · 2026-05-14
  topics: Fee schedule update; Risk tolerance review
  excerpts:
    - "[42.1s] We're stepping you up to the 1.25 tier effective June 1..."
    - "[180.4s] Confirmed comfortable with the new pricing..."

[meeting:cl1yyy] Sarah Johnson · Suitability Check · 2026-05-28
  topics: Suitability confirmation
  excerpts:
    - "[15.2s] Just to confirm what we agreed in May about the fees..."
</evidence>

Question: Did Sarah discuss fee changes at the May review?
```

The response is returned verbatim to the client. Citation extraction is **structural, not parsed from prose** — we cite every meeting that made it into the evidence block (not every meeting the model name-dropped), which prevents hallucinated citations from leaking through.

### 5.5 Schema Changes

**Single migration, additive only.** No new tables in Phase 1.

```prisma
enum AuditAction {
  // ...existing values...
  AI_QUERY
}
```

Migration command (per project skill):

```bash
npx prisma migrate dev --name add_ai_query_audit_action
```

No `searchableText` change required — it already has everything we need.

### 5.6 Files to Create / Modify

| Path                                            | Change                                                                                          |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `src/app/api/ask/route.ts`                      | **New.** Route handler, Zod validation, `requireAppAccess`, retrieval + LLM call + audit log.   |
| `src/server/ask/index.ts`                       | **New.** Orchestrator: keyword extraction, Prisma retrieval, scoring, context assembly.         |
| `src/server/ask/prompt.ts`                      | **New.** System prompt constant + user message builder. Pre-approved template strings only.    |
| `src/server/ask/rate-limit.ts`                  | **New.** In-memory (Phase 1) or Redis-backed (uses existing `REDIS_URL`) rate limit by user.    |
| `src/server/ask/types.ts`                       | **New.** `AskRequest`, `AskResponse`, internal scoring types.                                   |
| `src/server/ask/index.test.ts`                  | **New.** Vitest happy-path + zero-evidence + cross-workspace red-team tests.                    |
| `src/components/global-search.tsx`              | **Modify.** Detect Ask mode (trailing `?` or `ask:` prefix), render `AnswerCard`, call `/api/ask`. |
| `src/components/global-search/AnswerCard.tsx`   | **New.** Renders answer + citation chips, "open meeting ↗" deep links, loading/error states.    |
| `prisma/schema.prisma`                          | **Modify.** Add `AI_QUERY` to `AuditAction` enum.                                                |
| `src/env.js`                                    | **Modify.** Optional new vars: `ASK_MAX_CONTEXT_TOKENS`, `ASK_RATE_LIMIT_PER_MIN` (defaults baked in). |
| `.env.example`                                  | **Modify.** Document optional Ask vars.                                                          |

---

## 6. Compliance & Regulatory Guardrails

> ⚠️ COMPLIANCE IMPACT — this section is non-negotiable. Every item is a launch gate.

### 6.1 Workspace Isolation

- Every Prisma query in the Ask pipeline **must** filter by `workspaceId` from `requireAppAccess`. No exceptions, no admin override.
- Red-team test: seed two workspaces (A and B). Ask a question from workspace A whose answer exists only in workspace B. Assert the response is "I don't have evidence…" and that workspace B's data does not appear in logs, model context, or response payload. This test ships in `src/server/ask/index.test.ts` and runs in CI.

### 6.2 No Hallucinated Regulations

- The system prompt explicitly forbids citing CFR sections, SEC rules, or any external regulatory text.
- We do **not** inject any regulatory corpus into the context. The model has only the user's meeting evidence to work with.
- Output post-processing (Phase 1.1, low-cost add): regex-scan the LLM output for patterns like `\d+\s*CFR\s*§?\s*\d+`, `Rule\s+\d{3}-\d`, `Section\s+\d+\(a\)\(\d+\)`. If matched, replace the answer with "I generated regulatory text I wasn't authorised to produce. Please rephrase the question." and log the incident.
- This aligns with project rule §6 ("never hallucinate regulatory citations — only use pre-approved template strings").

### 6.3 Soft-Delete & Status Filtering

- Retrieval excludes `deletedAt != null` and meetings in `UPLOADING`, `TRANSCRIBING`, `PROCESSING`, or `ERROR` status — only `DRAFT_READY` and `FINALIZED` content is queryable. Half-baked extractions don't get used as evidence.
- A "Show in-progress meetings too" toggle is out of scope for Phase 1.

### 6.4 PII Handling in Logs

- `AuditEvent.metadata` stores: `questionLength`, `questionHash` (SHA-256, first 16 chars), `retrievedMeetingIds`, `candidatesScanned`, `model`, `latencyMs`. **Never the raw question text and never client names.** Operators can correlate by hash if a user reports a bad answer, but the audit log is not a transcript of what advisors asked.
- All `console.warn` / `console.error` paths scrub the question and meeting evidence before logging. Error messages returned to the client never echo back evidence content.

### 6.5 LLM Provider Data Handling

- Default provider is OpenAI with `gpt-4o-mini`. OpenAI API data is not used for training (per their API terms), but we should still:
  - Document this in `docs/architecture-as-built.md` as a data-handling note.
  - Add a workspace-level toggle (Phase 2) to switch to Anthropic or Vertex for firms that require it.
- The evidence block sent to the LLM contains client names and transcript text — this is the minimum necessary for grounded answers, and matches the existing extraction pipeline that already sends transcripts to the same providers. No new data egress posture; we are not crossing a new line.

### 6.6 Audit Trail

```ts
await ctx.prisma.auditEvent.create({
  data: {
    workspaceId,
    userId: session.user.id,
    action: "AI_QUERY",
    resourceType: "workspace",
    resourceId: workspaceId,
    metadata: {
      questionLength: question.length,
      questionHash: sha256(question).slice(0, 16),
      retrievedMeetingIds,
      candidatesScanned,
      model,
      latencyMs,
      mode: "keyword",
    },
  },
});
```

Append-only, never updated, never deleted — same audit guarantees as every other compliance event in the system.

---

## 7. Failure Modes & Fallbacks

| Failure                                         | User experience                                                                                       | System behaviour                                                                  |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| No retrieval matches                            | "I don't have evidence for that in your meeting records."                                             | LLM **not** called. Saves cost. Logged with `candidatesUsed: 0`.                  |
| LLM provider timeout / 5xx                      | Card flips to "Couldn't generate an answer right now." Keyword results shown below.                   | Audit logged with `error: "LLM_PROVIDER_ERROR"`. No retry beyond 2 attempts.      |
| LLM output contains banned regulatory citation  | "I generated regulatory text I wasn't authorised to produce. Please rephrase."                        | Original answer discarded. Incident logged with `metadata.outputBlocked: true`.   |
| Rate limit exceeded                             | "You've asked a lot of questions in the last minute — try again in 30s."                              | 429 response. Not logged as an audit event (it's not a query, just a throttle).   |
| Workspace has zero meetings                     | "Your workspace doesn't have any finalised meetings yet. Try Ask again once you've finalised one."    | LLM **not** called. Empty-state UX.                                               |

---

## 8. Rollout & Verification

### 8.1 Phase 1 Sprint Plan (5 working days)

| Day | Deliverable                                                                                                  |
| --- | ------------------------------------------------------------------------------------------------------------ |
| 1   | Migration (`AI_QUERY` enum); `src/server/ask/{index,prompt,types}.ts` scaffolds; happy-path unit test green. |
| 2   | Retrieval pipeline (`searchableText` + scoring); cross-workspace red-team test green.                        |
| 3   | LLM call + response shape; rate limiter; regulatory-citation post-filter; provider error handling.           |
| 4   | `AnswerCard` component; integration into `GlobalSearch` (Ask mode toggle); loading/error UX.                 |
| 5   | E2E Cypress spec (ask a known question on seeded demo data); audit-log verification; staging deploy.         |

### 8.2 Staging Gates

- [ ] `npx prisma migrate deploy` clean
- [ ] Seeded demo workspace returns the expected answer for the two empty-state example queries
- [ ] Cross-workspace red-team test passes in CI
- [ ] Rate limit verified manually (15 questions in 60s → throttle after #10)
- [ ] Audit log entries inspected: no question text, no client names in metadata
- [ ] Provider failure simulated (invalid `OPENAI_API_KEY`) → card falls back to keyword results, no 500 to client

### 8.3 Production Promotion

- [ ] All staging gates green
- [ ] DB backup taken before migration
- [ ] PR reviewed; merge `staging` → `main`
- [ ] Watch Vercel logs for 30 minutes — alert on >5% LLM error rate or any cross-workspace ID surfacing in metadata

---

## 9. Open Questions

1. **Streaming vs one-shot.** Phase 1 ships one-shot for simplicity. Worth revisiting if p95 > 8s in practice — streaming the answer text would mask the synthesis latency.
2. **Per-meeting "Ask about this meeting" CTA.** Should we surface the Ask flow on the meeting detail page using the `meetingId` scope from §5.2? Recommend yes, as a Phase 1.1 follow-up — same endpoint, different entry point, near-zero extra work.
3. **Phase 2 embedding granularity.** Per-meeting embedding vs per-segment? Per-segment gives better citations but multiplies storage. Defer until Phase 1 usage data is in hand.
4. **Multi-language transcripts.** Current `generateSearchableText()` lowercases everything but is otherwise language-agnostic. The LLM handles multiple languages natively. No new work — flag if a UK/EU pilot hits a non-English meeting.
5. **Project rule deviation on tRPC.** See §5.1. Worth a separate conversation about whether to migrate the codebase to tRPC or amend the rule to reflect the actual route-handler pattern. Not a blocker for this feature.

---

## 10. Appendix — Quick-Start Checklist for the Implementing Agent

1. Read `src/components/global-search.tsx`, `src/app/api/search/route.ts`, `src/server/search/index.ts`, and `src/server/extraction/openai.ts` first. Do not skip — every pattern this PRD relies on lives in those four files.
2. Add `AI_QUERY` to `AuditAction` in `prisma/schema.prisma`. Run `npx prisma migrate dev --name add_ai_query_audit_action` and `npx prisma generate`.
3. Build `src/server/ask/` bottom-up: types → prompt → retrieval → orchestrator. Unit-test each layer.
4. Wire `src/app/api/ask/route.ts` with `requireAppAccess` + Zod validation. Follow the response envelope from §5.2 exactly.
5. Extend `GlobalSearch` to detect Ask mode and render `AnswerCard`. Do **not** remove the existing keyword search flow — both coexist.
6. Verify §6 compliance guardrails one at a time, with a written test for each.
7. Ship to staging behind a soft feature flag (`NEXT_PUBLIC_ASK_ENABLED=true` in `.env.staging` only) for the first 48 hours, then enable in production.
