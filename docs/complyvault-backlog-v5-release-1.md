# Backlog v5: Release 1 — Hypothesis-Testing Demo

**Supersedes:** v4 (`complyvault-backlog-v4-defensible-slices.md`), and the AdvizorStack demo brief (`advizorstack-demo-brief.md`, `CV-AS-*` IDs)
**Status:** Build-ready. This is the consolidated version — v1 through v4 are history, not references.
**Target:** 10 Aug 2026 AdvizorStack demo (11 calendar days from 30 Jul, alongside a full-time role)

---

## 0. Purpose of the 10 August session

Not: "show Nico what he asked us to build." No call with Nico or Elle Scott has taken place; the 22 July call was postponed and nothing has been validated by AdvizorStack.

Instead:

> **Show a coherent set of partner-relevant capabilities, observe which ones create urgency, and use that evidence to determine the paid-pilot scope.**

Release 1 therefore tests five product hypotheses through a representative live demonstration, and one commercial hypothesis through a concrete partnership proposal.

**The demo proves this sentence:**

> ComplyVault can retrieve the underlying evidence, show exactly what it searched, refuse to overstate what it knows, assemble a reviewable examination-response pack, and give a platform partner a portfolio-level view of where supervision evidence is weak.

---

## 1. Partner hypotheses as Release 1 requirements

None of these is a buyer requirement. All are hypotheses the demo is designed to test. Optimising a release around a reconstructed version of what the buyer wants is the failure mode this table exists to prevent.

| Ref | Hypothesis | Basis | Confidence |
|---|---|---|---|
| N1 | Source-linked answers to open questions differentiate ComplyVault from summarisation and note-taking tools | Plausible differentiator; consistent with the CCO evidence problem | Medium-high |
| N2 | Zero setup to first evidence matters decisively for a platform serving many adviser firms | Structural: setup cost is what kills tools in a 100+ adviser stack | High |
| N3 | Examination-response preparation is a material CCO pain point worth demonstrating | Known pain in RIA compliance; AdvizorStack has not requested this workflow | Medium-high |
| N4 | Visible fail-closed behaviour builds trust with compliance buyers | Compliance-buyer pattern; not attributable to AdvizorStack specifically | High |
| N5 | AdvizorStack's multi-firm structure makes a portfolio view strategically relevant | Inferred directly from their platform model | High |
| N6 | Any reseller, platform, or channel arrangement needs a clear economic reason | Structural requirement of any partnership | Very high |

**Operating consequences:**

1. The session opens by testing hypotheses, not performing against them. Two or three questions to Nico before any asset renders; the demo order follows what he confirms.
2. Every asset is cheap to reorder or drop. No set piece that assumes any one hypothesis is his top concern.
3. **CV-VL-02, this week:** one email to Nico or a pre-call with Elle Scott — "would it be most useful to see exam-response assembly, the cross-firm view, or evidence retrieval?" One sentence converts up to three hypotheses into an agenda he chose. Worth more than any engineering day before the 10th.

### Traceability

| Epic | Tests |
|---|---|
| EPIC-AX Ask ComplyVault, demo slice | N1 |
| EPIC-OB Zero setup to first evidence | N2 |
| EPIC-XR Candidate Response Pack | N3 |
| EPIC-FC Fail-closed demonstration | N4 |
| EPIC-PV Demo-only partner portfolio | N5 |
| EPIC-CM Commercial proposition | N6 |
| EPIC-EA Evidence foundation | N1, N3, N4 |
| EPIC-Q Needs Attention surface | N4, N5 |

Nothing in Release 1 tests no hypothesis. ID families: `CV-EA/AX/OB/XR/FC/PV/CM/Q/DM/VL-*`, with `CV-G-*` (gates) deferred whole to Release 2. Existing `CV-C-*`, `CV-T-*`, `CV-B-*`, `CV-A-*`, `CV-TR-*` untouched.

---

# RELEASE 1

**Budget:** 6.0 engineering days + 1.0 day preparation, rehearsal, deployment. Validation runs parallel on someone else's calendar.

---

## EPIC-AX: Ask ComplyVault, demo slice (N1) — 2.25d

**Scope discipline:** a demonstration slice, not the production retrieval platform. One demonstration workspace, email threads and meeting transcript segments only, one controlled backfill. Generic resumable backfill, multi-workspace indexing, and operational monitoring are Release 2 (CV-AX-05b).

### CV-AX-05a: Semantic retrieval, demo workspace — 1.25d, 8 tests, demo critical ✅ done (2026-07-30)

- pgvector enabled. Embeddings over the demo workspace's email threads and transcript segments only.
- Hybrid retrieval: vector fused with existing keyword, so exact identifiers still match exactly.
- Chunking respects thread and transcript cue boundaries where VTT timestamps exist.
- One-time controlled backfill script, clearly marked demo-scope. Not resumable, not generic.
- Written evaluation set: 10 known-answer topics, 3 phrasings each, recall recorded.

### CV-AX-06: Index coverage and honest miss — 0.3d, 8 tests, never cut ✅ done (2026-07-30)

- Coverage manifest per workspace: sources indexed, date ranges, gap periods, last index time.
- Below-threshold confidence or unindexed source: the answer names what is missing and what range is covered, then stops. Never answers from the nearest available material.
- A tested code path, not presenter discipline.
- Adversarial suite: unindexed channels, out-of-range dates, no-evidence topics. Each declines specifically.

### CV-AX-00: Provenance contract — 0.2d, 9 tests, never cut ✅ done (2026-07-30)

- Structural labels on every answer element: source evidence, firm policy, regulatory material, system inference, reviewer decision.
- Never approves, denies, states a legal conclusion, invents a record, omits contradictory retrieved evidence, or returns an uncited compliance assertion. Adversarial tests included.

### CV-AX-01: Search mode — 0.3d, 6 tests, demo critical ✅ done (2026-07-30)

- Queries across email and meeting evidence, hash-verified citations resolving in one click.
- Every answer states whether the result is a **complete population under the stated filters** or a **ranked sample**. Load-bearing for N3.

### CV-AX-02: Explain mode — 0.2d, 5 tests, first to cut ⏭ cut (Release 1)

### Question tiers

| Tier | What it is | Valid outcomes |
|---|---|---|
| **Rehearsed** | Known question proving the ideal experience | Cited answer |
| **Paraphrased** | Nico phrases a known topic in his own words | Cited answer |
| **Open** | Genuinely unprepared question | Cited answer, **or** a specific honest miss, **or** a labelled ranked sample — all three are valid |

The Open tier is allowed to miss. A specific honest miss in front of a compliance buyer is a feature demonstration. CV-DM-01 seeds an unindexed source and an out-of-range window so the miss path is invocable on purpose.

---

## EPIC-OB: Zero setup to first evidence (N2) — 1.05d

**The promise (say this out loud):** zero setup to first evidence — connect a mailbox; nobody types client records; usable evidence and exposure appear immediately.

**What zero setup means here:** no policy wizard, no client CRUD, no CSV import before value. OAuth → ingest → resolve → land on what the mailbox disclosed.

**What it does not mean (never claim):** that every participant is a confirmed client. High-confidence addresses resolve automatically; ambiguous identities are **held in the open** as part of the first-evidence reveal. A mailbox cannot know client-versus-prospect, households, or assistants writing for clients — holding those is product judgement, not incomplete setup.

### CV-OB-01: Deterministic identity resolution — 0.5d, 9 tests, never cut ✅ done (2026-07-30)

- Resolution order: exact email address, then domain plus known household, then CRM identifier where connected. Name similarity never auto-confirms.
- Every resolution carries method and confidence. Low confidence routes to the existing unknown-sender triage queue.
- Replaces name matching on the client dashboard.
- The held-for-confirmation state is a first-class UI state and part of the demo. Showing an ambiguous identity waiting for the CCO demonstrates judgement; hiding it would fake certainty.

### CV-OB-02: Controlled connect path — 0.3d, 5 tests, demo critical ✅ done (2026-07-30)

- OAuth → progressive ingestion → resolution runs live against a **prepared demonstration mailbox** with known contents, including seeded ambiguous identities.
- Progress UI names each stage: authorising, enumerating, ingesting, classifying, resolving. Partial results render progressively.
- Recorded run of the same flow as fallback.
- If Nico offers a real mailbox on the call: "that becomes the pilot's first act, on an authorised workspace." The run sheet has that line written down.

### CV-OB-03: Auto-built client timeline — 0.25d, 5 tests, cut candidate ⏭ cut (Release 1)

---

## EPIC-XR: Candidate Response Pack (N3) — 0.8d

**Named deliberately.** "Responsive pack" would claim the system correctly interpreted scope and found the complete responsive population; it can honestly claim neither. Candidate evidence, reviewed and approved by the CCO, is the version a former examiner's client can defend.

### CV-XR-01a: Request item to candidate pack, with scope confirmation — 0.5d, 8 tests, demo critical ✅ done (2026-07-30)

The flow:

1. CCO pastes a single document-request item.
2. System displays its **interpretation**: proposed people and entities, date range, channels, concepts, exclusions.
3. **CCO confirms or edits the scope. Nothing generates before confirmation.**
4. System retrieves candidate evidence via the existing audit pack generator.
5. Coverage statement identifies exclusions and known gaps.
6. CCO approves the pack for export.

- The confirmed scope is stored with the pack. The word "responsive" appears nowhere.
- Pack contains: candidate records, hash manifest, `AuditEvent` chain root for the range, confirmed scope, retrieval basis.
- Generation under two minutes on the demo corpus, measured from scope confirmation.

The scope-confirmation screen is not friction — it is the demo. Watching the system say "here is how I read your request, correct me" is the moment a compliance buyer relaxes.

### CV-XR-01b: Coverage and gap statement — 0.3d, 6 tests, never cut (may shrink to one line per pack) ✅ done (2026-07-30)

- Per-item statement: answerable, partially answerable, missing, requires manual confirmation, or data source unavailable. Missing periods and unindexed sources named with date ranges.
- The system never states that the firm is exam ready.

---

## EPIC-FC: Fail-closed demonstration (N4) — 0.2d

### CV-FC-01: Refusal surface and audit event view — 0.2d, 4 tests, never cut ✅ done (2026-07-30)

One screen showing, from the already-shipped CV-TR-06/06a posture gate:

- The refusal and its reason, the retention rule protected, the parked record (`parked: true`), the **actual stored audit event** (not a rendering), and the manual re-trigger recovery path.

Remains in Release 1 under all circumstances.

---

## EPIC-PV: Demo-only partner portfolio (N5) — 0.5d

**No cross-workspace read path exists in Release 1, verified by test.** A production cross-tenant access model (role modelling, central enforcement, record-level isolation, deep-link/cache/export isolation, audit design) is not an 11-day artifact, and a security mistake in front of a partner prospect is categorically worse than any demo shortfall.

### CV-PV-01s: Snapshot model and portfolio view — 0.5d, 6 tests, demo critical ✅ done (2026-07-30)

```ts
type PartnerFirmSnapshot = {
  firmId: string;
  displayName: string;
  coverageCompleteness: number;
  overdueItems: number;
  oldestItemDays: number;
  evidenceGaps: EvidenceGap[];
  lastIngestionAt: string | null;
  contributingFactors: string[];
};
```

- Three representative seeded firms with visibly different exposure profiles.
- Per row: evidence coverage, ageing and unresolved issues, ingestion gaps, and **explicit named exposure factors** — no composite score without its factors.
- Reuses the existing Compliance Health Score calculation. Nothing invented for the view.
- One row drills into the demo workspace's Needs Attention surface, demonstrating the concept without cross-tenant reads.
- **Said out loud on the day:** production partner access ships with the pilot, isolation guarantees stated up front. Sequencing security before shipping is respectable; implying a read path that doesn't exist is not.

**Release 2 carries the production reader verbatim from v3's criteria:** allowlist-only from `UserWorkspace`, read-only, one enforced accessor, every cross-workspace read audited, isolation suite (zero rows not filtered rows, 404 not 403, endpoint fuzzing). First engineering act of the pilot.

---

## EPIC-EA: Evidence foundation (N1, N3, N4) — 0.9d

### CV-EA-01: Unified `ComplianceItem` contract — 0.35d, 8 tests ✅ done (2026-07-30)

- Shared interface over `Flag` (meeting and email scoped) and other actionable sources, via adapters. No migration, no new unified table.
- **Capability contract:** each item type declares which actions are valid for it (reviewable, approvable, dismissible, assignable, none). Generic surfaces render only declared capabilities — no disabled approve button on a record type that has no approval concept.

### CV-EA-02: Source evidence link — 0.25d, 6 tests, never cut ✅ done (2026-07-30)

- `EvidenceRef` supports email/message id, meeting id plus timestamp offset, transcript segment, document version, policy clause, regulatory citation.
- Resolves to the viewable source in one click, carries `sha256` where the record has one. Broken refs render as an explicit state, never silently omitted.

### CV-EA-03: Chain view — 0.3d, 6 tests, demo critical ✅ done (2026-07-30)

- Renders Source → Reason surfaced → Reviewer decision → Action taken → Closure evidence, timestamped and attributed.
- Stage states: **complete, pending, missing, not applicable.** A record that legitimately required no enforcement action shows that stage as not applicable. Missing means expected and absent, nothing else.
- Same component for every source kind.

---

## EPIC-Q: Needs Attention surface (N4, N5) — 0.4d

The queue shrinks but does not vanish: fail-closed parked ingestion, evidence gaps, unresolved identities, the partner drill-down, and candidate packs awaiting confirmation all need one landing surface.

### CV-Q-01m: Single Needs Attention section — 0.4d, 8 tests ✅ done (2026-07-30)

- One section, ordered by severity then age. No ranking model, no pattern grouping, no cleared-overnight section — those return with the full queue rebuild in Release 2.
- Every card answers: what happened, why it matters, what evidence exists, **what is missing**, what action is expected, and when it is due.
- Reads `ComplianceItem` via adapters only. Renders only capabilities the item declares.

---

## EPIC-CM: Commercial proposition (N6) — 0.25d, never cut

### CV-CM-01: Complement map — 0.1d ✅ done (2026-07-30)

One page. Hadrius, Zocks, FastTrackr AI: what each does, what ComplyVault does not do, and the specific job ComplyVault does that none covers. Completing the stack, not replacing it — consistent with the standing positioning decision.

### CV-CM-02: Partner economics and pilot proposal — 0.15d ✅ done (2026-07-30)

- Three shapes with numbers: referral fee per converted firm, volume licence across the adviser base, white-label with a margin the partner bills advisers against.
- Pilot scope: free, two or three of their firms, defined success criteria, and the production partner-access build as its first engineering act.
- A clear next step with a date.

N6 is the hypothesis most likely to determine the outcome and the only one that costs almost nothing. It does not get skipped because it is not code.

---

## EPIC-DM: Demo choreography — 1.0d (calendar-spread)

### CV-DM-01: Seed and corpus — 0.3d ✅ done (2026-08-01); neon parity (2026-08-03)

- Corpus built to the tiered question plan: Rehearsed guaranteed, Paraphrased coverage measured by the evaluation set, plus a deliberately unindexed source and out-of-range window for the invocable honest miss.
- Held identities (email triage + unmatched Robert Chen meeting), parked Zoom ingest, `IndexCoverageManifest` upserted per workspace.
- Three seeded partner firms with distinct profiles (snapshot fixtures). Prepared demonstration mailbox identities in triage.
- Run: `npx tsx scripts/seed-demo.ts --workspace=<id> --confirm` then `npx tsx scripts/demo-embed-backfill.ts <id>`.
- Neon HTTP fallback (same CV-DM-01 extras): `node scripts/seed-demo-neon.mjs <id> --confirm`.

### CV-DM-02: Run sheet, hypothesis test, fallbacks — 0.2d ✅ done (2026-07-30)

### CV-DM-03: Rehearsal and deployment — 0.5d 🔨 checklist ready (2026-08-03); rehearsals pending (calendar)

- Deploy + two-rehearsal checklist: `docs/demo/deploy-and-rehearsal.md`
- Two-corpus rule documented in run sheet (live Gmail vs seed Ask corpus)
- Calendar: complete Rehearsal 1 + Rehearsal 2 and day-before freeze before 10 Aug

---

## Validation — parallel, blocks release

### CV-VL-01: Compliance review

Janice Powell or Miles Edwards reviews the candidate-pack language, the scope-confirmation flow, and the coverage-statement wording — specifically whether "answerable" and "partially answerable" survive contact with a former examiner. Starts Day 2.

### CV-VL-02: Hypothesis check — send this week 🔨 draft ready (2026-08-03); send pending

The one-sentence email or Elle Scott pre-call described in section 1. Highest leverage item in the document.

- Draft: `docs/demo/vl-02-email.md` — copy, subject lines, reorder table after reply.

---

## Budget and cut order

| Epic | Est |
|---|---|
| EPIC-AX | 2.25d |
| EPIC-OB | 1.05d |
| EPIC-XR | 0.80d |
| EPIC-FC | 0.20d |
| EPIC-PV | 0.50d |
| EPIC-EA | 0.90d |
| EPIC-Q | 0.40d |
| EPIC-CM | 0.25d |
| EPIC-DM | 1.00d |
| **Total** | **7.35d** |

Engineering 6.0d, preparation and rehearsal 1.0d, validation parallel. Against 11 calendar days with a day job: tight, honest, and it fits because gates, cross-tenant access, and the production retrieval platform are all out.

**Cut order:**
1. CV-AX-02 Explain mode
2. CV-OB-03 timeline (keep resolution; show results more plainly)
3. CV-XR-01b shrunk to a single coverage line per pack
4. CV-Q-01m shrunk to the drill-down card alone

**Never cut:** CV-AX-06 honest miss, CV-AX-00 provenance, CV-OB-01 identity resolution with the held state, CV-XR-01a scope confirmation, CV-FC-01, CV-EA-02, CV-CM-01, CV-CM-02.

Each never-cut item is the difference between a demo that builds trust and one that creates a liability, and each is the easiest kind of thing to rationalise away on Day 9.

---

# RELEASE 2: "Decide and enforce, on real partner access"

Scoped by pilot evidence — the demo's observed urgency reorders this list before it is built.

1. **CV-PV-01/02/03:** production multi-workspace reader with the full isolation suite. Nothing partner-facing ships before it.
2. **CV-AX-05b:** production retrieval — generic resumable QStash backfill, multi-workspace indexing, observability, tuning against real corpora (the 3.5–7d the demo slice deferred).
3. **EPIC-G in full:** gate framework (request state machine, fail-closed routing, decision register), personal trading with all nine rules — CV-G-04a reportability under its own compliance review — schema-driven form, policy settings with the unreviewed-defaults banner.
4. **EPIC-CC:** coverage dashboard (six channel states), processing health, evidence-based off-channel indicators, gap workflow retaining proof the firm detected and acted.
5. Bulk-confirm affordance for held identities — 100+ advisers implies hundreds of ambiguous identities on first real connect.
6. CV-EA-04 action creation, CV-AX-03 Assemble and CV-AX-04 Analyse, full four-section queue with ranking and pattern grouping, register and export with chain verification, notifications at three levels, expiry crons.

# RELEASE 3: "The CCO operating system"

Unchanged: EPIC-MR marketing review (Hadrius sequencing constraint stands — build once the AdvizorStack relationship exists, or earlier only if Nico raises it), full exam simulator, deficiency and remediation tracking, CCO continuity pack, gifts and entertainment, political contributions with the government client register, OBA, fee billing under its own PRD, Reg S-P incident clock, regulatory change to task, partner API and MCP.

---

# Definition of done

## Engineering

1. Acceptance criteria met and demonstrable. Existing suite green (186 tests / 33 files baseline); Release 1 adds ~120.
2. `tsc --noEmit` clean. No `any` in new server modules.
3. Every posture refusal writes an `AuditEvent`; the chain verifies.
4. Ask ComplyVault never answers outside its index coverage; every answer element carries a provenance label.
5. Every generated pack is labelled candidate; no scope executes without stored CCO confirmation.
6. No cross-workspace read path exists, verified by test.
7. Every identity resolution carries method and confidence; low confidence never auto-resolves.
8. No LLM in any refusal, isolation, or ordering path.
9. Feature flags gate all new routes and UI.

## Demo outcomes

| Ref | The hypothesis is tested when |
|---|---|
| N1 | All three question tiers behave as specified, including a specific honest miss when invoked — and Nico's reaction to the Open tier is observed and noted |
| N2 | Zero setup is stated; mailbox connects with no client typing; first evidence lands on exposure (held identity visible) — and his reaction to “held = product, not unfinished setup” is noted |
| N3 | Interpreted scope shown, CCO confirms, candidate pack with coverage statement in under two minutes — and whether he asks about his own last document request is noted |
| N4 | Refusal, reason, and stored audit event on one screen |
| N5 | Three firms ranked with named factors, one drills into the real workspace, the production-access sentence said out loud — and whether he asks when he can have it is noted |
| N6 | The economics page is presented with a pilot proposal and a dated next step — and which commercial shape he engages with is noted |

The "noted" clauses are the point. The session's output is not a completed performance; it is evidence about which hypotheses hold, and that evidence sets the pilot scope.

## Pilot metrics

Median submission-to-decision time, percentage of items with complete source evidence, items past SLA, manual reconstruction steps avoided per cycle, ingestion coverage by channel, override rate with reasons, repeat adviser patterns detected, and examiner-request questions answerable without manual search — the renewal number.

---

# Open questions

1. Can CV-VL-02 go out this week?
2. Which real document-request item seeds CV-XR-01a, and can Ernest C'DeBaca or Andrew Schuster confirm the wording is representative of current exam letters?
3. Should one of the three seeded portfolio firms mirror an anonymised real profile, or is fully fictional cleaner given no AdvizorStack data authorisation exists?
4. Does the held-identity bulk-confirm affordance need design (not build) before the demo, in case Nico asks how first-connect scales to 100+ advisers?
5. Release 2, for Kent Keister: how would his firms want off-channel indicators framed to advisers, given the supervision-versus-surveillance perception inside a client firm?
