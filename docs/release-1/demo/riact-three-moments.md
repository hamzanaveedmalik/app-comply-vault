# RIACT three-moment demo (0:11–0:23)

No dashboard tour. Login lands on the letter.

**Flags:** `RELEASE1_DEMO_ENABLED=true`, `NEXT_PUBLIC_RELEASE1_DEMO=true`, `EMAIL_INTELLIGENCE_ENABLED=true`

**Seed:** `npx tsx scripts/seed-riact.ts --confirm` then optionally `npx tsx scripts/demo-embed-backfill.ts riact-ws-cactus`

**Login:** `/demo/riact` → `cco.demo@riact.synthetic.example.com` / `RiactDemo2026!`

## A · Document request → Candidate Pack (~5 min)

1. Open cold on `/document-request` (demo login goes here).
2. Line: *This arrived Tuesday. Here's what happens next.*
3. **Assemble Candidate Pack** → scope confirm → generate → scrolls to **Coverage and gaps**.
4. Land on **What it could not find** (Aug–Nov 2025 index gap + SMS not connected).
5. Approve if time allows.

## B · Fail-closed refusal (~3 min)

1. ⌘K → Ask chip: *What did Marcus Holloway say over SMS about the 401(k) rollover?*
2. Expect **Will not answer** — SMS not indexed; does not infer.
3. Line: *That refusal is correct. You capture text and SMS — if ComplyVault reads your archive, that becomes an answer with a hash.*

## C · Ask with citations (~4 min)

1. Same Ask: *What advisory fee discussions did we have with Marcus Holloway by email?*
2. Show citation hashes on Evidence rows.
3. Boundary: *Not an archive. It reads what's already stored. Deliberate limit, not a roadmap gap.*

## Smoke

```bash
npx tsx scripts/verify-riact-demo.ts
```
