---
tags:
  - archive
  - demo
---

# AdvizorStack Demo Build Brief

> **Superseded.** Build from [complyvault-backlog-v5-release-1.md](../release-1/complyvault-backlog-v5-release-1.md). This brief (`CV-AS-*`) is retained for history only.

**Target:** 10 Aug 2026
**Surface:** `app.complyvault.co/demo/advizorstack` (masked, separate from main app)
**Audience:** Nico DeMaio, AdvizorStack. Runs 100+ advisers. Existing stack includes Hadrius (monitoring), Zocks (adviser meeting notes), FastTrackr AI (advisor transitions / repapering).
**Context:** Nico postponed the 22 Jul call because he was mid-transition project. He is inside a repapering cycle right now.

---

## 0. Rules of engagement

Read these before writing any code.

1. **Six moments, not a feature tour.** Everything in this document exists to serve one of the six moments in section 2. If a task does not serve one, it is out of scope for 10 Aug.
2. **Real means real.** Ask ComplyVault, audit pack export, email correspondence sync, fail-closed posture gate and Compliance Cockpit levers must run against the real codebase. Anything staged must be visually obvious to us and never claimed as live.
3. **Never claim coverage we do not have.** Nico's team has been through SEC exams. Overclaiming loses the parts we can actually do. Where the product cannot answer, the UI says so plainly.
4. **He will go off script.** Assume every screen gets probed with an input we did not anticipate. Graceful degradation beats a polished happy path.
5. **Do not position against FastTrackr or Zocks.** FastTrackr moves accounts. Zocks writes adviser notes. Hadrius monitors. ComplyVault holds the evidence of what was advised and communicated. Four jobs.

New story IDs use the `CV-AS-*` family. Do not reuse `CV-C-*`, `CV-T-*`, `CV-B-*` or `CV-TR-*`.

---

## 1. Current state

What already exists and can be leaned on:

- Email ingest live for Gmail + M365. Threads stored as evidence, EMAIL source type, MIME + SHA-256, participant matching with a triage queue for unknown senders.
- Ask ComplyVault over email with hash citations, behind the `emailIntelligence` flag. 123 tests passing.
- Polymorphic Flag, EvidenceClassification, client correspondence and ClientActivity models.
- Audit pack export (the real name for what the demo calls "Export Pack"), importable from the production app.
- Fail-closed media posture gate at `src/server/retention/media-posture.ts`, wired into all five meeting-creation paths, decision screen at `/settings/media-posture`, app-shell banner. CV-TR-06/06a shipped.
- Parked ingests return 200 with `parked: true` plus an AuditEvent.
- Compliance Health Score as a real weighted calculation: Meeting Coverage 30%, Documents Finalised 25%, Flags Resolved 25%, Signatures Complete 20%, cached nightly.
- IntegrationHub adapter pattern (connect / sync / disconnect / handleWebhook).

Known gaps that matter for this demo:

- Retrieval is keyword-only. No pgvector.
- Classification runs inline on ingest, not via QStash.
- Dashboard name-matches meetings to Client rows.
- No household CRUD UI.
- Email classification is a stub. Emails never reach the Review Queue. Full email risk classification is EPIC-C, unbuilt.
- No cross-workspace view of any kind.

---

## 2. The six moments

### CV-AS-01 to 03 — Moment 1: the unscripted question

**What Nico sees:** He types his own question, something like "did anyone discuss annuity replacements with a client over 70 this quarter", and gets an answer spanning email and meetings with citations he can click through to a hash-verified source.

**Why it matters:** This is the moment he stops thinking of it as a summary tool. It is also the single highest-risk moment in the demo, because retrieval is keyword-only and he will not phrase things the way our seed data does.

**Build:**

- `CV-AS-01` Query expansion layer in front of Ask ComplyVault. Before retrieval, expand the user query into a synonym and domain-term set (annuity replacement / 1035 exchange / surrender / rollover; older investor / retiree / RMD / age references). Static domain dictionary is acceptable for 10 Aug. Log the expansion so we can debug live.
- `CV-AS-02` Citation resolution. Every citation in an answer must be clickable and open an evidence viewer showing the source document, its SHA-256, ingestion timestamp and participants. The hash must be visible on screen, not buried.
- `CV-AS-03` Honest miss path. When retrieval returns below a confidence threshold, Ask ComplyVault says the corpus does not contain matching evidence and offers the nearest adjacent results, clearly labelled as adjacent. It must never fabricate. This path is a feature in the demo, not a failure: it is the difference between an evidence tool and a chatbot.

**Acceptance:** Ten pre-written adversarial paraphrases of the seeded scenarios all return either a correct cited answer or an honest miss. Zero fabricated citations across the ten.

---

### CV-AS-04 to 05 — Moment 2: zero setup, reframed as zero input

**What Nico sees:** A mailbox connects, and within ninety seconds the system knows who the clients are, builds the timeline and matches participants with nobody typing a client record.

**Important reframe.** FastTrackr already sells him "the data arrives without you typing it". A populated client table is his baseline, not a reveal. The novelty is not ingestion, it is what the system noticed. Do not end this moment on a table.

**Build:**

- `CV-AS-04` Demo connect flow. Live OAuth against the seeded demo mailbox on a `complyvault.co` domain (not gmail.com: a consumer address undercuts the whole pitch). Progress states must be real, driven by actual ingest events.
- `CV-AS-05` Exposure reveal screen. After sync, instead of a client table, surface a ranked list of what the mailbox disclosed:
  - households with a transition conversation in the period
  - a client fee question with no written answer in the thread
  - a recommendation to a client over 70 with no supporting documentation
  - a conversation that moved to a personal address mid-transition
  - the triage queue holding unknown senders

  Each row links to evidence. The triage queue is a stronger beat than a clean table because it proves the system is reasoning rather than parsing: show it deliberately.

**Acceptance:** Connect to reveal in under two minutes, with no manual data entry at any point, ending on the exposure list rather than a roster.

---

### CV-AS-06 to 08 — Moment 3: the exam artifact

**What Nico sees:** A real SEC request-list item on screen, then the response pack produced in front of him in about two minutes. Work his team currently does by hand over days.

**Source of truth:** SEC Division of Examinations Risk Alert, 6 Sept 2023, "Investment Advisers: Assessing Risks, Scoping Examinations, and Requesting Documents", and its attachment "Typical Initial Information Examiners Request of Investment Advisers".
`https://www.sec.gov/files/risk-alert-ia-risk-and-requesting-documents-090623.pdf`

Two items in that attachment are the ones we serve:

- Compliance programme section: client complaints and correspondence, and the process for monitoring those communications including electronic communication.
- Portfolio management section: client portfolio profile information covering investment objectives, strategy, risk tolerance, suitability and mandates.

Note the sequencing, and say it out loud on the day: the initial list is organised by category, not by a named client sample. Client-specific suitability pulls typically arrive in supplemental rounds. Getting this right buys credibility with a team that has lived through exams.

**Build:**

- `CV-AS-06` Request-item mapping. A config file mapping SEC request-list items to ComplyVault evidence types and queries. Ship only the items we genuinely serve. Do not stub the rest.
- `CV-AS-07` Audit pack structure. The generated pack contains: an index mapping request item to evidence; per-client sections; every item traceable to source with SHA-256 and timestamp; and an access log showing who exported it and when.
- `CV-AS-08` **Gap declaration.** The pack states plainly where evidence does not exist, for example that no documentation exists for two meetings in scope. This is the detail that separates the product from an AI toy. A CCO does not trust a clean-looking answer, they trust one that shows exposure while there is still time to fix it.

**Coverage statement, to be shown in the pack and said unprompted:** we serve communications, recommendation documentation, supervision evidence and off-channel coverage. We do not serve trading, custody, marketing review or code of ethics items.

**Acceptance:** Pack generates in under two minutes, every entry hash-traceable, gap section populated with at least two real gaps from seed data.

---

### CV-AS-09 — Moment 4: fail-closed

**What Nico sees:** The system refusing to proceed when evidence would be lost, and the AuditEvent it writes.

This is mostly built. CV-TR-06/06a shipped the posture gate across all five meeting-creation paths.

**Build:**

- `CV-AS-09` A deliberate trigger path in the demo tenant that fires the gate on demand, plus a visible AuditEvent viewer showing the written record: actor, timestamp, decision, affected evidence. Show the `parked: true` behaviour and explain that a parked item requires a CCO decision before it moves.

Compliance buyers respond to "this cannot silently drop evidence" more than to anything AI-flavoured. Give this moment room. Do not rush it.

**Acceptance:** Gate fires live, banner appears, AuditEvent row is visible on screen within the same flow.

---

### CV-AS-10 to 11 — Moment 5: the view across all his firms

**What Nico sees:** Which of his adviser firms is exam-exposed this quarter, and why. Not one RIA's dashboard.

**This is the largest build in the brief and it does not exist today.** The data model is Workspace-scoped with no roll-up. Treat this as the make-or-break item: it is the only moment that is a product for AdvizorStack rather than for a single CCO.

**Build:**

- `CV-AS-10` Read-only partner roll-up. Aggregate the existing Compliance Health Score across workspaces into a single ranked view. Reuse the existing weighted calculation, do not invent a second scoring model. Columns: firm, score, trend, open flags, evidence gaps, last audit pack generated.
- `CV-AS-11` Exposure reasons. Each firm row expands to show why it ranks where it does, tied to real signals: undocumented meetings, unresolved flags, correspondence without matching documentation, posture decisions pending.

**Exam-trigger framing to use on the day, and it is sourced.** The SEC risk alert lists material changes in a firm's leadership or personnel among its exam-selection factors, and firms with significant growth, acquisitions or business model changes should expect heightened examination interest. A transition is exactly that. FastTrackr proves the account moved correctly. Nothing in his stack proves the advice given while it moved was suitable and documented.

**Acceptance:** At least four seeded workspaces, ranked, each expandable to real underlying reasons. No hardcoded scores.

---

### CV-AS-12 — Moment 6: what it replaces or what he can sell

Not a code task, but it needs a screen.

He already pays for Hadrius and Zocks. A third line item needs a reason. Something he can bill his advisers for is a different conversation entirely.

**Build:**

- `CV-AS-12` Per-workspace usage surface on the partner roll-up: evidence volume, packs generated, hours of audit prep displaced. Enough to support a per-firm pricing conversation.

Bring a number for audit-prep hours saved, sourced from Janice Powell if no better data exists. FastTrackr publishes hard claims (75% faster end to end, 95% NIGO reduction). He is used to vendors quantifying themselves.

---

## 3. Seed data

The demo mailbox must be a **transition mailbox**, so Nico recognises his own week rather than a generic RIA.

- Hosted on a `complyvault.co` address. Not gmail.com.
- Three to six months of threads across six to eight households.
- Include the messy cases: spouses on the thread, a client emailing from a personal address, an unknown sender that lands in the triage queue.
- At least one scenario matching current SEC priorities: a recommendation involving a complex, illiquid or high-cost product made to an older investor or someone saving for retirement. FY2026 priorities name this explicitly, so it is the likeliest shape of an unscripted question.
- At least two deliberate evidence gaps, so the audit pack gap section is real.
- Four workspaces minimum for the roll-up, with genuinely different health profiles.

A thin inbox produces a thin reveal and kills moment 2.

---

## 4. Build order and cut line

Ordered by risk to the demo, not by effort.

1. `CV-AS-10`, `CV-AS-11` partner roll-up. Largest build, only moment that is a product for AdvizorStack specifically.
2. Seed data. Everything else depends on it and it is always underestimated.
3. `CV-AS-01`, `CV-AS-03` query expansion and honest miss path. Highest live-failure risk.
4. `CV-AS-04`, `CV-AS-05` connect flow and exposure reveal.
5. `CV-AS-06` to `CV-AS-08` request mapping, pack structure, gap declaration.
6. `CV-AS-02` citation resolution viewer.
7. `CV-AS-09` fail-closed trigger path.
8. `CV-AS-12` usage surface.

**Cut line:** if time runs short, cut `CV-AS-12` and the polish on `CV-AS-02`. Do not cut `CV-AS-03` or `CV-AS-08`. The honest-miss path and the gap declaration are what make the rest believable.

**Do not let this displace CV-TR-07 permanently.** Discard execution, gated on persisting `transcriptSha256`, remains the critical path after 10 Aug.

---

## 5. Risks

| Risk                                                                | Mitigation                                                                                          |
| ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Unscripted question misses, or worse, answers confidently and wrong | `CV-AS-01` expansion plus `CV-AS-03` honest miss. Rehearse ten adversarial paraphrases.             |
| Zero-setup lands flat because FastTrackr already set that baseline  | `CV-AS-05`. End on exposure, never on a table.                                                      |
| Staged elements get probed                                          | Keep staged surfaces out of clickable paths. Say "that one is not built yet" rather than improvise. |
| Roll-up looks hardcoded                                             | Reuse the real weighted score. Let him pick a firm and drill in.                                    |
| Overclaiming exam coverage                                          | Ship the coverage statement in `CV-AS-07` and say it before he asks.                                |

---

## 6. Follow-up worth doing before the 10th

Andrew Schuster (ClearView Regulatory Compliance) is a former SEC Exam Manager and Ernest C'DeBaca (Regulatory Insight Advisors) is a former SEC attorney, both already in the pipeline. A redacted request list and a sanitised deficiency letter from either would make the exam-artifact moment unarguable, and asking is a clean reason to reopen both threads this week.
