---
tags:
  - ux
  - prd
---

# Firm Onboarding Flow — CRD Lookup → Disclosure Cockpit (delta)

**Feature:** Tighten the existing CRD-driven firm-profile setup into a single, auditable two-step creation flow.
**Owner:** ComplyVault
**Target:** June 2 demo (vertical slice)
**Data source:** sec-api.io Form ADV API (via the existing IAPD proxy)

> ⚠️ This is a **delta spec**. The onboarding flow already exists. Do **not** build a parallel
> stack. Every change below is an edit to existing files. See §1 for the as-built inventory and
> §2 for the three decisions that must be signed off before any code lands.

---

## 0 · Context for the implementing agent

We already ship a workspace-scoped firm-profile setup wizard. Today it:

1. **Step 1 — Firm details.** CRD field with on-blur IAPD lookup (`useCrdLookup` →
   `/api/iapd/firm/[crd]` → sec-api.io). Auto-fills CCO, AUM, filing date, and derived risk flags;
   all fields stay editable. Saves a `DRAFT` `FirmProfile`.
2. **Step 2 — Disclosure review.** Renders the 12-category catalog grouped core/regulatory/
   operational. Three categories are `neverSuppress` (locked) **by static catalog config**. The CCO
   ticks an acknowledgement and completes setup, which writes the categories, a
   `FirmProfileVersion` snapshot, and `AuditEvent` rows.

This delta does **three** things and nothing else:

- **A. Reframe Step 1 as a read-only confirmation** once a firm is found (not a wall of editable
  inputs), with disambiguation when `BusNm !== LegalNm`.
- **B. Fix the Step 2 control polarity and gate the completion button** on the acknowledgement.
- **C. Decide and document how never-suppress locks are determined** (static vs ADV-derived) — this
  is a compliance decision, not an implementation detail (see §2).

**Non-goals:** new Prisma models, new routes, a new `lib/adv/*` namespace, freeform-text audit
entries, or moving the app out of `src/`. All of those duplicate working code.

---

## 1 · As-built inventory (do not recreate these)

| Concern | Existing file | Notes |
|---|---|---|
| CRD proxy (server) | `src/app/api/iapd/firm/[crd]/route.ts` | Auth-gated; tries sec-api then IAPD search. |
| sec-api mapping | `src/lib/iapd-sec-api-mapper.ts` | Typed `SecApiFirmFiling` → `IapdFirmLookupResult`. |
| Risk-flag derivation | `src/lib/risk-flags.ts` | `deriveRiskFlags(part1A)`. **See §2/§5 — field mappings are disputed.** |
| Client lookup hook | `src/hooks/useCrdLookup.ts` | Debounced/aborting fetch with demo-mode delay. |
| Category catalog | `src/lib/disclosure-categories.ts` | 12 categories, **hyphen slugs**, `neverSuppress` flags. |
| Wizard UI | `src/components/compliance-cockpit/FirstRunWizard.tsx` | Two-step state already lives here. |
| Card / grid | `.../DisclosureCard.tsx`, `.../DisclosureGrid.tsx` | Status-driven rendering. |
| Completion + audit | `src/server/firm-profile/complete-wizard.ts` | Tx: categories + version + `AuditEvent`. |
| Profile API | `src/app/api/workspaces/[workspaceId]/firm-profile/route.ts` | `auth` + membership + `canWriteCockpit`. |
| Prisma | `FirmProfile`, `DisclosureCategory`, `SuppressionLogEntry`, `FirmProfileVersion` | Have `createdAt/updatedAt`; `FirmProfile` is soft-deletable and `workspaceId @unique`. |

**Hard constraints carried over from the codebase (must not regress):**

- Slugs are **hyphenated** (`conflicts-of-interest`), not `snake_case`.
- One `FirmProfile` per workspace (`workspaceId @unique`) — not keyed by CRD.
- Suppressing a category **requires evidence (≥20 chars)** and writes a `SuppressionLogEntry`.
  No new control may bypass this.
- All API routes are auth + workspace-membership gated; business logic lives in `src/server/`.
- Next 15 route handlers receive `params: Promise<…>` and must `await` it.

---

## 2 · Decisions required before coding (sign-off needed)

These are unresolved and **block implementation**. Each is a compliance-relevant choice.

### Decision 1 — Static vs ADV-derived never-suppress locks ⚠️ COMPLIANCE IMPACT
Today, `conflicts-of-interest`, `insurance-comp`, and `disciplinary-history` are `neverSuppress: true`
**unconditionally** in the catalog. The original draft proposed computing locks from ADV flags, so a
firm whose ADV does not trip a narrow flag would leave Conflicts/Disciplinary **unlocked** and
suppressible. That is *less* conservative than today and could let a firm suppress a disclosure a
careful CCO would always force.

- **Option A (recommended, default):** keep locks static. ADV flags only *annotate* the lock with a
  firm-specific reason ("Locked — required for all advisers; your ADV also discloses … Item 11D").
  Zero compliance regression; the ADV provenance still appears on the card.
- **Option B:** make locks ADV-derived. Requires explicit compliance sign-off and a documented
  fallback rule for clean ADVs (most likely: still lock the three regulatory categories regardless).

> Until signed off, build Option A. It is the smaller, safer change and matches shipped behavior.

### Decision 2 — Reconcile ADV field mappings (factual)
`risk-flags.ts` and the original draft disagree on what some Part 1A fields mean. These must be
verified against the ADV Part 1A field dictionary and made canonical in one place:

| Concept | `risk-flags.ts` (shipped) | Original draft | Action |
|---|---|---|---|
| Insurance Affiliate | `Item7A.Q7A12 === 'Y'` | `Item7A.Q7A2 === 'Y'` | Verify; pick one. |
| Municipal Advisor | (not emitted) | `Item7A.Q7A12 === 'Y'` | Q7A12 can't mean both. |
| Dual-Hat | `Item5B.Q5B5 > 0` | aliased to insurance | Keep `Q5B5`; do not alias. |
| Pooled Vehicle Sponsor | `Item7A.Q7A16 === 'Y'` | suppress (`Item7B.Q7B`) | Verify field + intent. |
| Regulatory History | `Item11D.Q11D2` only | all of `Item11A–H` | Port the broader 11A–H check in. |
| Multi-State | `Item2A.Q2A10 === 'Y'` | `NoticeFiled.States.length > 1` | Pick one basis. |

Output of this decision: a single corrected `deriveRiskFlags` (extend the existing function; do not
fork it). The 11A–H breadth from the draft is a genuine improvement worth merging.

### Decision 3 — CRD validation bounds
The route/hook accept `^\d{4,7}$`; the draft used 6–7 digits. Pick one bound and use it in
`useCrdLookup`, the route, and the error copy. (CRD 141195 passes either way.)

---

## 3 · Change A — Step 1 read-only confirmation

**File:** `src/components/compliance-cockpit/FirstRunWizard.tsx` (+ optional
`FirmConfirmationCard.tsx` extracted from it).

Current Step 1 always shows editable inputs. Change to two visual states keyed off `iapdLookup`:

- **Before a successful lookup:** show the CRD field prominently; keep the manual fields available
  (we must still support `not_found` / partial-data firms — do not remove the manual path).
  Subtext: "We'll pull everything from SEC IAPD — you just need the CRD."
- **After `iapdLookup === 'found'`:** render the returned `IapdFirmLookupResult` as a **read-only
  confirmation card** — firm name, city/state, ADV filed, AUM as muted-label facts, plus the
  existing `RiskFlagChips` under "Risk flags · derived from ADV". The only editable field is **CCO
  name** (IAPD doesn't reliably give current CCO) — keep it as an input with a pencil affordance.
- **Disambiguation:** `IapdFirmLookupResult` currently exposes `firmName` only. To support
  `BusNm !== LegalNm`, add `legalName` to the mapper (`iapd-sec-api-mapper.ts`) and
  `IapdFirmLookupResult` (`iapd-types.ts`). When they differ, show a warning and require an explicit
  "Yes, this is the right firm" toggle before enabling Continue.
- **Provenance line:** "Sourced from SEC IAPD · CRD {crd} · filed {date}" (the existing
  `IapdSourceBadge` already covers the sec-api case — reuse it).
- **Primary CTA copy:** "Yes, set up this firm" (replaces "Continue") **only** in the found state.

Failure-state copy (wire into the existing `crdLookupError` / `iapdLookup` branches — most already
exist):

| Condition | UX |
|---|---|
| `not_found` | Already handled: "No matching firm found in IAPD — you can still continue with this CRD." Keep. |
| `error` (upstream/abort) | Already handled. Add cached-fallback **only if** §6 caching is built; otherwise leave as-is. |
| invalid CRD | Inline, using the §2/Decision-3 bound. |

No persistence changes here — Step 1 still POSTs a `DRAFT` profile exactly as today.

---

## 4 · Change B — Step 2 control polarity + acknowledgement gate

**Files:** `DisclosureCard.tsx`, `FirstRunWizard.tsx`.

### B1 — Fix the triple-negative control
`DisclosureCard` currently renders, for a non-suppressed card, an **"Off" button** *and* a **"Not
suppressed"** status label with a hollow circle — three negatives for one state. Replace with one
positively-framed control describing the *outcome*:

- Suppressing (`SUPPRESSING`) → toggle reads **"Flag only when relevant"**.
- Active (`ACTIVE`) → toggle reads **"Always flag if missing"**.

Keep the underlying enum (`ACTIVE | SUPPRESSING | NEVER_SUPPRESS`) and the existing evidence-modal
flow untouched — this is a label/affordance change, not a state-model change. Drop the redundant
bottom status row for non-locked cards (the toggle now states the outcome).

### B2 — Locked cards
`DisclosureCard` already renders locked cards with a red top border, lock icon, and no interactive
control — keep that. **Add** a visible `lockReason` line on the card (the title-attribute tooltip is
not auditable on screen). Under Decision 1/Option A the reason is the standing regulatory
requirement, optionally enriched with the ADV citation when a matching flag is present.

### B3 — Header copy
In `FirstRunWizard.tsx`, replace the Step 2 subtitle "Step 2 — Toggle suppressible items as needed."
with "Confirm which disclosures must be verbally delivered in every client meeting." (decision of
record, not optional fiddling).

### B4 — Acknowledgement gate
Today "Complete setup" is always enabled and only errors on click. Change to:

- **Disable** "Complete setup" until `neverSuppressAck` is checked; show the disabled state visibly.
- Build the acknowledgement label from the locked category display names **dynamically**
  (`DisclosureGrid` already computes `neverSuppressNames` from `NEVER_SUPPRESS_SLUGS` — lift that or
  reuse it) instead of the hard-coded "Conflicts of Interest, Insurance Comp., and Disciplinary
  History" string.

---

## 5 · Change C — provenance on the existing audit trail

**File:** `src/server/firm-profile/complete-wizard.ts` (already writes the audit on completion).

Do **not** introduce `writeFirmCreatedAudit.ts` or a stored prose blob. The completion transaction
already emits structured `AuditEvent` rows (`CCO_ACKNOWLEDGED_NEVER_SUPPRESS`,
`DISCLOSURE_SUPPRESSION_ACTIVATED`) plus a `FirmProfileVersion` snapshot. Enhance, don't replace:

- Ensure the ADV provenance (`source`, `fetchedAt`/`advFilingDate`, derived flags) is captured in
  the `CCO_ACKNOWLEDGED_NEVER_SUPPRESS` metadata or the version snapshot, so the chain
  CRD → ADV → locked categories → CCO acknowledgement → confirmer/timestamp is fully reconstructable
  from structured data.
- The examiner-facing "provenance tree" is a **render** over those structured events (build it in
  the export pipeline per rules §9), never a stored string.
- PII note: firm/CCO/CRD in the audit *artifact* is the adviser's own data and is fine; keep client
  names and financial data out of general logs/error messages per rules §6.

No schema changes are required for Option A. (Option B in Decision 1 would need a place to store the
per-firm lock reason — defer until/unless Option B is chosen.)

---

## 6 · Caching (post-demo, optional)

The original "48h CRD cache" was only a TODO and no UX should depend on it until built. If added,
cache at the **server** layer (`src/server/iapd/…`), key `adv:{crd}`, and only then wire the
"show cached data on upstream error" branch in Step 1. Out of scope for June 2.

---

## 7 · Acceptance criteria

- [ ] Entering CRD `141195` shows a **read-only confirmation card**: Secure Investment Management,
      LLC · Tucson, AZ · filed 2026-04-16 · AUM $42,909,330, with CCO as the only editable field.
- [ ] Derived flags for 141195 match the **reconciled** `deriveRiskFlags` (Decision 2). No flag is
      emitted that the ADV doesn't support.
- [ ] Step 2 shows exactly one positively-framed toggle per suppressible card; **no** card shows the
      "Off" button + "Not suppressed" + circle triple-negative.
- [ ] Locked cards have no interactive control and display an on-screen `lockReason`.
- [ ] Locked categories are determined per the **signed-off** Decision 1 (Option A: the three
      regulatory categories always lock).
- [ ] "Complete setup" is **disabled** until the acknowledgement is ticked; the ack text lists the
      locked categories dynamically.
- [ ] Suppressing any category still requires ≥20-char evidence and writes a `SuppressionLogEntry`.
- [ ] "Back" from Step 2 does not trigger a second IAPD/sec-api call.
- [ ] No `FirmProfile` transitions to `ACTIVE` until "Complete setup"; Step 1 only writes `DRAFT`.
- [ ] `SEC_API_KEY` never reaches the client (already true — lookup goes through the auth-gated
      proxy).
- [ ] Completion writes the structured audit chain (version snapshot + `AuditEvent` rows) with ADV
      provenance; the examiner view renders from those events.
- [ ] If `BusNm !== LegalNm`, an explicit disambiguation confirmation is required before Step 2.

---

## 8 · Build order for June 2

1. **Decisions (§2).** Get sign-off on locks (D1), reconcile field mappings (D2), fix CRD bound (D3).
   Land the corrected `deriveRiskFlags` + tests first.
2. **Step 1 confirmation state (§3)** in `FirstRunWizard.tsx`; add `legalName` to mapper + type for
   disambiguation.
3. **Step 2 polarity + ack gate (§4)** in `DisclosureCard.tsx` / `FirstRunWizard.tsx`; on-screen
   `lockReason`.
4. **Audit provenance (§5)** in `complete-wizard.ts`.
5. (Post-demo) caching (§6), full failure-state polish.

> Reminder: any Prisma change requires `prisma generate` + a migration. Option A needs **no** schema
> change; if Decision 1 lands on Option B, surface the migration command before editing
> `schema.prisma`.
