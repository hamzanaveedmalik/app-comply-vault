---
tags:
  - release-1
  - demo
---

# Release 1 demo run sheet

**Surface flags:** `RELEASE1_DEMO_ENABLED=true` and `NEXT_PUBLIC_RELEASE1_DEMO=true`  

**Two corpora — do not mix claims:**
1. **Live mailbox (N2 zero setup):** Connect Gmail → Labels → **Backfill**. Counts must come from that sync only. Never say “what the mailbox disclosed” about DB seed rows.
2. **Ask / honest-miss rehearsal (N1):** `node scripts/seed-demo-neon.mjs <id> --confirm` then embed backfill. Prepared evidence for known questions. If the live mailbox is empty, say once that this is a prepared corpus — do not put that label on the screen.

## Open: test the hypotheses

Before showing a product surface, ask:

1. Which would be most useful today: evidence retrieval, examination-response assembly, or a portfolio view?
2. How important is immediate usefulness after a mailbox connection?
3. Which commercial shape is most plausible for your adviser base?

Reorder the middle of the session around the answers. The default sequence below is the fallback.

## Default order

1. **Zero setup to first evidence (N2).** Connect the prepared demo mailbox → Labels → **Backfill**. Say: “Zero setup — nobody types client records.” Only after a sync timestamp appears, use the CTA **What the mailbox disclosed** (Needs Attention): held identities, open signals, parked fail-closed. Do **not** end on a client table. Do **not** attribute DB seed rows to the mailbox. Line for held identity: “Held for confirmation is the product working, not unfinished setup.”
2. **Tiered questions (N1).** Use the seeded Ask corpus. If the live mailbox is empty, say once: “This is a prepared corpus so we can test retrieval honestly.” Start with a rehearsed question, accept a paraphrased question, then offer an open question. Every answer should retain source links and its coverage context.
3. **Honest miss fallback.** Invoke on purpose (seeded):
   - SMS: “Show me SMS messages about fees”
   - Out of range: “What fee emails do we have from 2023-02-15?”
   - No evidence: “Any evidence of private jet gifts to clients?”  
   Line: “This source or period is outside the indexed coverage. I can show what was searched and what is missing, but I will not infer an answer from nearby evidence.”
4. **Fail-closed ingestion (N4).** `/fail-closed` — parked Zoom source, reason, retention rule, stored `INGEST_PARKED` audit event, recovery via media posture.
5. **Candidate pack (N3).** Paste one document-request item (example below). Show interpreted scope, make the CCO confirmation explicit, generate candidate evidence, review coverage gaps, then approve.
6. **Portfolio snapshot (N5).** `/partner/portfolio` — three firms, named exposure factors, drill only into **Summit Ridge Advisors, LLC**. Say once: “This is a prepared portfolio snapshot; production partner access ships with the pilot.”
7. **Commercial proposition (N6).** `/partner/complement` then `/partner/economics`. Ask which shape is worth testing in a pilot.

## Seeded Ask tiers (CV-DM-01)

| Tier | Question | Expect |
|---|---|---|
| Rehearsed | Show me every email where a client mentioned fees since April | Cited answer |
| Rehearsed | Has any advisor promised performance in writing? | Cited answer (disclaimer email) |
| Rehearsed | When did we last hear from Margaret Ellison and about what? | Cited answer |
| Honest miss | Show me SMS messages about fees | Unindexed source |
| Honest miss | What fee emails do we have from 2023-02-15? | Out of range |
| Honest miss | Any evidence of private jet gifts to clients? | No evidence + coverage |

## Example document-request item (CV-XR)

> Produce all email and meeting records for Margaret Ellison regarding fees from 2025-01-01 to 2025-06-30, excluding SMS and personal messaging channels.

**Expect:** ~14 fee emails + 3 meetings (May 2025 left empty on purpose). Coverage shows search population, matches, May gap, excluded-by-request SMS/personal messaging, and WhatsApp/Teams not connected.

## Spoken honesty (once, not on screen)

Do not show “demo”, “synthetic”, or “Release 1 demo” chrome. Say once, early: “This session uses a prepared corpus so we can test retrieval and coverage honestly — it is not live AdvizorStack production data.” Then stay in product language.

## Written fallback lines

- **Slow sync:** “The recorded run has the same prepared mailbox and staged outcomes; we will use it so we can preserve time for the evidence and scope decisions.”
- **Ambiguous identity:** “The system has intentionally held this identity for confirmation rather than assigning a plausible match.”
- **Offer of a real mailbox:** “That becomes the pilot’s first act, on an authorised workspace.”
- **Candidate-pack boundary:** “This is candidate evidence under a confirmed scope. A CCO must review it before any examination use.”

## Close

Propose a free pilot with two or three firms, agree the success criteria, and set a dated next step: select firms and a commercial shape by 17 August 2026.

## Related

- Deploy + rehearsal checklist: [deploy-and-rehearsal.md](./deploy-and-rehearsal.md) (CV-DM-03)
- Hypothesis agenda email: [vl-02-email.md](./vl-02-email.md) (CV-VL-02)

## Related documentation

- [[deploy-and-rehearsal]]
- [[vl-02-email]]
- [[complyvault-backlog-v5-release-1]]
- [[Go-to-Market-Map|Go-to-Market Map]]
