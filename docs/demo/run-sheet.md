# Release 1 demo run sheet

**Surface flags:** `RELEASE1_DEMO_ENABLED=true` and `NEXT_PUBLIC_RELEASE1_DEMO=true`  
**Corpus:** `npx tsx scripts/seed-demo.ts --workspace=<id> --confirm` then `npx tsx scripts/demo-embed-backfill.ts <id>`

## Open: test the hypotheses

Before showing a product surface, ask:

1. Which would be most useful today: evidence retrieval, examination-response assembly, or a portfolio view?
2. How important is immediate usefulness after a mailbox connection?
3. Which commercial shape is most plausible for your adviser base?

Reorder the middle of the session around the answers. The default sequence below is the fallback.

## Default order

1. **Zero setup to first evidence (N2).** Connect the prepared demo mailbox. Say: “Zero setup — nobody types client records.” Show staged progress, then land on **What the mailbox disclosed** (Needs Attention): held identities, open signals, parked fail-closed. Do **not** end on a client table. Line for held identity: “Held for confirmation is the product working, not unfinished setup.”
2. **Tiered questions (N1).** Start with a rehearsed question, accept a paraphrased question, then offer an open question. Every answer should retain source links and its coverage context.
3. **Honest miss fallback.** Invoke on purpose (seeded):
   - SMS: “Show me SMS messages about fees”
   - Out of range: “What fee emails do we have from 2023-02-15?”
   - No evidence: “Any evidence of private jet gifts to clients?”  
   Line: “This source or period is outside the indexed coverage. I can show what was searched and what is missing, but I will not infer an answer from nearby evidence.”
4. **Fail-closed ingestion (N4).** `/fail-closed` — parked Zoom ref `demo-parked-zoom-recording-001`, reason, retention rule, stored `INGEST_PARKED` audit event, recovery via media posture.
5. **Candidate pack (N3).** Paste one document-request item (example below). Show interpreted scope, make the CCO confirmation explicit, generate candidate evidence, review coverage gaps, then approve.
6. **Portfolio snapshot (N5).** `/partner/portfolio` — three firms, named exposure factors, drill only into **A Small Investment, LLC**. Say: “Production partner access ships with the pilot; Release 1 has no cross-workspace read path.”
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

> Produce all email and meeting records for Margaret Ellison regarding fees from 2025-01-01 to 2026-06-30, excluding SMS and personal messaging channels.

## Written fallback lines

- **Slow sync:** “The recorded run has the same prepared mailbox and staged outcomes; we will use it so we can preserve time for the evidence and scope decisions.”
- **Ambiguous identity:** “The system has intentionally held this identity for confirmation rather than assigning a plausible match.”
- **Offer of a real mailbox:** “That becomes the pilot’s first act, on an authorised workspace.”
- **Candidate-pack boundary:** “This is candidate evidence under a confirmed scope. A CCO must review it before any examination use.”

## Close

Propose a free pilot with two or three firms, agree the success criteria, and set a dated next step: select firms and a commercial shape by 17 August 2026.
