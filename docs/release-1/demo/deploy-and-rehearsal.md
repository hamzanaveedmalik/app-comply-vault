---
tags:
  - release-1
  - demo
---

# CV-DM-03 — Deploy and rehearsal checklist

**Demo date:** 10 August 2026  
**Surface:** production demo workspace on `app.complyvault.co`  
**Do not mix corpora:** live Gmail sync (N2) vs seeded Ask corpus (N1). See [run-sheet.md](./run-sheet.md).

## Automate (when credentials are present)

```bash
# Set flags + redeploy + seed N1 corpus
export VERCEL_TOKEN=…                 # or: vercel login
export DATABASE_URL=…                 # demo Neon (current .env twilight password is stale)
export DEMO_WORKSPACE_ID=…            # A Small Investment, LLC workspace id
node scripts/demo-dm03-prepare.mjs

# Seed only
node scripts/demo-dm03-prepare.mjs --seed-only
```

**Done 2026-08-03:**
- Vercel flags set to `true` (were empty strings) + production redeploy
- Seeded workspace `cmkyri10q0007l104stmnl00y` (A Small Investment, LLC): held=3, parked=1
- Embed backfill via `scripts/demo-embed-backfill-neon.mjs` (21 embedding rows)

**Still human:** signed-in UI smoke, N2 live Gmail backfill, two timed rehearsals, day-before freeze.

**Automate route existence:** `node scripts/demo-dm03-rehearsal-smoke.mjs` (writes `dm03-rehearsal-scorecard.md`).

## A. Deploy (once, then re-verify before each rehearsal)

- [x] Vercel env: `RELEASE1_DEMO_ENABLED=true`
- [x] Vercel env: `NEXT_PUBLIC_RELEASE1_DEMO=true`
- [x] Optional for semantic Ask: `ASK_HYBRID_RETRIEVAL=true` (and embedding provider keys already present)
- [x] Migrations already applied on demo Neon (no pending)
- [x] Redeploy production; confirm build green
- [x] Routes exist on `app.complyvault.co` (HTTP 307 → auth as of 2026-08-08 smoke)
- [ ] Sign in to workspace **A Small Investment, LLC** (`cmkyri10q0007l104stmnl00y`); confirm Release 1 nav renders:
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
# Demo workspace (prod): cmkyri10q0007l104stmnl00y
node scripts/seed-demo-neon.mjs <workspaceId> --confirm
# Prefer Neon HTTP embed when Prisma TLS fails under MitM:
node scripts/demo-embed-backfill-neon.mjs <workspaceId>
# Prisma path (when TCP works): npx tsx scripts/demo-embed-backfill.ts <workspaceId>
```

Prisma path (when TCP works):

```bash
npx tsx scripts/seed-demo.ts --workspace=<workspaceId> --confirm
npx tsx scripts/demo-embed-backfill.ts <workspaceId>
```

Verify after seed:

- [x] Summary shows held identities ≥ 3 and parked ≥ 1 (held=3, parked=1, embeddings=21)
- [ ] `/fail-closed` shows parked Zoom source + stored `INGEST_PARKED` audit event
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
