# CV-DM-03 — Deploy and rehearsal checklist

**Demo date:** 10 August 2026  
**Surface:** production demo workspace on `app.complyvault.co`  
**Do not mix corpora:** live Gmail sync (N2) vs seeded Ask corpus (N1). See [run-sheet.md](./run-sheet.md).

## A. Deploy (once, then re-verify before each rehearsal)

- [ ] Vercel env: `RELEASE1_DEMO_ENABLED=true`
- [ ] Vercel env: `NEXT_PUBLIC_RELEASE1_DEMO=true`
- [ ] Optional for semantic Ask: `ASK_HYBRID_RETRIEVAL=true` (and embedding provider keys already present)
- [ ] `npx prisma migrate deploy` against the demo Neon DB (use non-pooler `DIRECT_URL`)
- [ ] Redeploy production; confirm build green
- [ ] Sign in to the demo workspace; confirm Release 1 nav routes render:
  - `/needs-attention`
  - `/fail-closed`
  - `/partner/portfolio`
  - `/partner/complement`
  - `/partner/economics`
  - Candidate pack entry (Ask / exam-response flow per run sheet)
  - Gmail connect: `/integrations/gmail-mail`

## B. Seed Ask / honest-miss corpus (N1)

Prefer Neon HTTP when Prisma TLS fails under corp MitM:

```bash
export DATABASE_URL='…'   # pooler OK for neon HTTP script
node scripts/seed-demo-neon.mjs <workspaceId> --confirm
npx tsx scripts/demo-embed-backfill.ts <workspaceId>
```

Prisma path (when TCP works):

```bash
npx tsx scripts/seed-demo.ts --workspace=<workspaceId> --confirm
npx tsx scripts/demo-embed-backfill.ts <workspaceId>
```

Verify after seed:

- [ ] Summary shows held identities ≥ 3 and parked ≥ 1
- [ ] `/fail-closed` shows parked Zoom `demo-parked-zoom-recording-001` + stored `INGEST_PARKED` audit event
- [ ] Rehearsed Ask questions return cited answers
- [ ] Honest-miss questions decline specifically (SMS / 2023 / private jet)

## C. Live mailbox path (N2) — separate claim

- [ ] Prepared demo Gmail connected via OAuth
- [ ] Labels selected → **Backfill** run to completion
- [ ] Zero-setup reveal shows **Last mailbox sync** timestamp
- [ ] CTA reads **What the mailbox disclosed** only after sync
- [ ] Never attribute seed-held identities to “what the mailbox disclosed” unless they also came from that sync

## D. Rehearsal 1 (full run sheet, timed)

Target: under 25 minutes including opens.

1. Three hypothesis questions (do not skip)
2. N2 zero setup → Needs Attention (held identity line spoken)
3. N1 rehearsed + paraphrased + open
4. Honest miss (pick one seeded)
5. N4 fail-closed
6. N3 candidate pack (paste XR example; confirm scope before generate)
7. N5 portfolio + production-access sentence
8. N6 complement → economics → dated next step (17 Aug)

Record: wall time, which fallbacks used, any broken citation.

## E. Rehearsal 2 (adversarial)

- [ ] Kill live sync mid-flow → deliver recorded-run fallback line
- [ ] Open-tier question that should miss → confirm specific decline
- [ ] Cold start: hard refresh each surface; no stale feature-flag 404s
- [ ] Second operator can run the sheet without the builder present

## F. Day-before freeze

- [ ] No schema or flag changes after freeze without a third rehearsal
- [ ] Seed + embed backfill re-run if data was touched
- [ ] Print or pin [run-sheet.md](./run-sheet.md) + [vl-02-email.md](./vl-02-email.md) agenda answers
