---
tags:
  - release-1
  - demo
---

# CV-VL-02 — Hypothesis check email (send this week)

**Purpose:** Convert up to three hypotheses into an agenda Nico chose. Highest-leverage item before 10 August.

**Send to:** `nico@advizorstack.com` (public LinkedIn contact; override with `VL02_TO` if Elle is the channel)  
**From:** whoever owns the AdvizorStack relationship (replace `[Name]` before send)  
**Subject:** Quick preference before our 10 Aug session

## Send

```bash
# Opens your mail client with a prefilled draft (recommended)
node scripts/send-vl02-email.mjs --mode=mailto

# Or Resend (requires your name + explicit confirm)
VL02_FROM_NAME="Your Name" VL02_REPLY_TO="you@complyvault.co" VL02_CONFIRM=yes \
  node scripts/send-vl02-email.mjs --mode=resend
```

## Body (copy)

Hi Nico —

Looking forward to the 10 August session. To use the time well: would it be most useful to see **exam-response assembly**, the **cross-firm portfolio view**, or **evidence retrieval** (source-linked answers from email and meetings)?

Happy to lead with whichever you pick and keep the rest short.

Thanks,  
[Name]

## If Elle Scott pre-call instead

Same one sentence. Ask her to confirm Nico’s preference before the day, or to sit in so she can redirect live.

## After a reply

| He prioritises | Open with | Still show (short) |
|---|---|---|
| Evidence retrieval | N1 tiered Ask + honest miss | N2, N3 or N5, N6 |
| Exam-response assembly | N3 candidate pack | N1 miss, N4, N6 |
| Cross-firm view | N5 portfolio + drill-down | N2 held identity, N6 |

Update the default order in [run-sheet.md](./run-sheet.md) the morning of the call. Do not invent a fourth set piece.

## Status

- [x] Draft approved (2026-08-03)
- [x] Mailto draft opened to `nico@advizorstack.com` (2026-08-03)
- [x] Sent confirmed (2026-08-08 via Resend id `9a77a388-f72d-485c-b479-3cea75173f87`)
- [ ] Reply / preference noted: ________
