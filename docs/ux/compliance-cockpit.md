---
tags:
  - ux
  - prd
---

# Compliance Cockpit — Product Requirements Document

**Product:** ComplyVault — Compliance Cockpit Control Panel  
**Version:** 1.4  
**Status:** Draft — Sprint-commit ready  
**Date:** May 30, 2026  
**Author:** Hamza Naveed, Founder — ComplyVault  
**Reviewers:** Engineering Lead, Head of Product Design  
**Context:** UX audit of v3 Compliance Cockpit; v4 redesign approved for sprint planning. Target spec for Epic 8.0 (Configurable Disclosure Profiles) in [prd-summary.md](../product/prd-summary.md).

**Related docs:** [architecture-as-built.md](../architecture/architecture-as-built.md) · [prd-summary.md](../product/prd-summary.md) (Epic 8.0)

**Changelog:**

- v1.0 — Initial UX spec
- v1.1 — Grounded against codebase; corrected stack assumptions
- v1.2 — Resolved skip-vs-downgrade; added §7.4 mapping, phasing, evidence requirement, profile versioning, role matrix, first-run state, error states, accessibility
- v1.3 — Rewrote §7.4 to match actual detection architecture (recommendation-centric, not category-centric); documented reprocess + remediation edge case (§7.5); resolved wizard-vs-approval versioning conflict; aligned nav access with role matrix; fixed stale §1 / §3.1 scope; replaced localStorage draft with server-side DRAFT status; added riskFlags edit path; added testing section (§10); added export/audit pack impact (§7.6); resolved open questions; schema nits fixed
- v1.4 — Fixed call-site paths in §7.4; profile-skip runs after missing-disclosure check; consolidated patterns in `disclosure-categories.ts`; extended `deleteMany` filter to `process-meeting`; export rules when approval invalidated; Phase 1a/1b split; ADVISOR access denied; mixed-category UI ACs; detection scope limitation documented

---

## 0. Implementation Status

The Compliance Cockpit **does not exist in the codebase today**. There is no route, nav item, component tree, Prisma model, or API handler for firm-level disclosure controls. The closest live surfaces are:

| Existing surface             | Route / path                                                     | Relevance to cockpit                                                |
| ---------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------- |
| Dashboard                    | `/dashboard` — `src/app/(app)/dashboard/page.tsx`                | CCO command centre; session metrics analogue only                   |
| Review queue                 | `/review` — `src/app/(app)/review/page.tsx`                      | Per-meeting sign-off, not firm-profile approval                     |
| Meeting flags panel          | `/meetings/[id]` — `src/app/(app)/meetings/[id]/flags-panel.tsx` | Per-meeting flag triage and remediation                             |
| Audit logs                   | `/audit-logs` — `src/app/api/audit-logs/route.ts`                | Append-only `AuditEvent` trail (no suppression actions yet)         |
| Missing-disclosure detection | `src/server/flags/missing-disclosure.ts`                         | Generic recommendation-centric regex; not category-aware — see §7.4 |

**Planned product home:** Epic **8.0 — Configurable disclosure profiles** (Phase 2, Q3–Q4 2026).

**Proposed route (greenfield):** `/compliance-cockpit` under `src/app/(app)/compliance-cockpit/`.

**Sidebar nav entry:** Visible to `OWNER_CCO` (write) and `MEMBER` (read-only). Hidden for `ADVISOR` — route returns 403 if accessed directly. Update `src/components/app-sidebar.tsx` to show the item for CCO and Compliance Manager roles only.

---

## 1. Overview

The Compliance Cockpit is ComplyVault's primary interface for CCOs and outsourced compliance consultants to manage **firm-level disclosure controls**. When built, toggling a category to "suppress" causes the flag engine to skip `MISSING_DISCLOSURE` flag creation for that category on future meetings. It does not affect per-meeting remediation or sign-off workflows.

**Phase 1 scope (this doc):** Phase 1a — models, API, wizard, flag skip integration. Phase 1b — cockpit UI, approval workflow, export section, mixed-category flag display.

**Phase 2 scope (deferred):** conflicts panel, ADV parse, Examiner Preview overlay, `PARTIAL` card state, session-scoped metrics.

---

## 2. Problem Statement

The following critical UX failures were identified during the v3 audit:

1. **Flat grid with no hierarchy.** All 12 categories at equal visual weight — no distinction between regulatory mandates and suppressible items.
2. **Never-suppress items buried mid-grid.** Conflicts of Interest, Insurance Comp., and Disciplinary History appeared identical to toggleable items.
3. **Conflicts panel under-weighted.** Active conflicts displayed in a thin sidebar with no severity indicators — deferred to Phase 2 with a placeholder.
4. **Suppression log given primary real estate.** Audit log dominated visual space at equal width to main controls.
5. **Firm header unstructured.** CCO name, AUM, ADV date, and CRD linearly concatenated with no grouping.

---

## 3. Goals & Non-Goals

### 3.1 Goals (Phase 1)

- A CCO can identify all never-suppress items within 3 seconds of opening the cockpit on a standard desktop viewport.
- The disclosure controls grid groups items by regulatory intent, not arbitrary sequence.
- Suppression requires attached evidence before committing — no silent toggles.
- The suppression log and approval workflow produce an audit trail sufficient for SEC examination.
- The redesign ships within the existing Next.js / shadcn/ui stack with no new dependencies.

> Goals deferred to Phase 2: conflict severity scanability, ADV page-ref population, Examiner Preview.

### 3.2 Non-Goals

- Meeting transcript ingestion or flag detection pipeline internals (see `src/server/extraction/`, `src/app/api/jobs/process-meeting/route.ts`).
- Mobile responsiveness — desktop-only CCO workflow.
- Multi-firm aggregation views (v5).
- External shareable read-only links for regulators.
- Full ADV Part 2A obligation scanning beyond recommendation-triggered missing-disclosure checks (see §7.4 detection scope).
- `PARTIAL` card state (Phase 2, requires ADV parse).

### 3.3 Phasing

Epic 8.0 Phase 1 is split into two delivery milestones (~1–2 sprints each).

**Phase 1a — Core suppression (Epic 8.0, Q3 2026, sprint 1–2)**

- `FirmProfile`, `DisclosureCategory`, `SuppressionLogEntry`, `FirmProfileVersion` models + API routes
- First-run wizard with server-side `DRAFT` status
- Disclosure controls grid — three states: `ACTIVE`, `SUPPRESSING`, `NEVER_SUPPRESS`
- Toggle suppression with mandatory evidence modal (server-side Zod validation)
- Flag skip integration — refactor `detectMissingDisclosureFlags` (see §7.4)
- `deleteMany` preservation filter on reprocess and process-meeting (§7.5)
- Role access: `OWNER_CCO` write, `MEMBER` read-only, `ADVISOR` no access

**Phase 1b — Cockpit UI + export (Epic 8.0, Q3 2026, sprint 2–3)**

- Three-panel cockpit layout, firm masthead, never-suppress attention strip, posture ring
- Suppression audit log (right panel) + rolling 30-day metrics
- Approve Profile workflow + `FirmProfileVersion` (`APPROVED`) snapshot
- Mixed-category display in `flags-panel.tsx` (AC-17)
- Firm Disclosure Profile section in meeting export PDF (§7.6)
- Conflicts placeholder in left panel

**Phase 2 — v4 UX polish + conflicts (Q4 2026)**

- Conflicts panel (`FirmConflict` model, spec in Epic 8.1 addendum)
- `PARTIAL` card state + "Complete training" CTA
- ADV Part 2A PDF upload → parse → auto-populate category page refs
- Source document viewer
- Session-scoped metrics
- Examiner Preview overlay
- `CRITICAL → CRITICAL` nav notification badge

---

## 4. Target Users

| User                | Role                                      | Primary Need                                           |
| ------------------- | ----------------------------------------- | ------------------------------------------------------ |
| In-house CCO        | Owns compliance for one RIA               | Fast sign-off; see what was suppressed and why         |
| Outsourced CCO      | Manages 10–50+ RIA clients                | Per-firm context switch via workspace dropdown; suppression profile per workspace |
| Compliance Manager  | Supports CCO; reviews flags               | Read-only cockpit access; cannot toggle or approve     |
| CCO (Examiner View) | CCO previewing profile as regulator would | Simulate examiner read-through before audit (Phase 2)  |

> **Persona note:** "SEC Examiner" from v1.1 has been corrected. External regulators cannot log in. Examiner Preview is a CCO simulation tool. External regulator access requires a separate shareable export feature — out of scope.

### 4.1 Role Matrix

| Feature                             | `OWNER_CCO` | `MEMBER`             | `ADVISOR`        |
| ----------------------------------- | ----------- | -------------------- | ---------------- |
| Navigate to cockpit (nav + route)   | ✅          | ✅ read-only         | ❌ — 403 / no nav |
| View categories and suppression log | ✅          | ✅                   | ❌               |
| Toggle suppression                  | ✅          | ❌ — absent from DOM | ❌               |
| Approve Profile                     | ✅          | ❌ — absent from DOM | ❌               |
| Examiner Preview (Phase 2)          | ✅          | ✅                   | ❌               |

Route guard in `page.tsx` enforces read-only render for `MEMBER` and returns 403 for `ADVISOR`. Toggle and Approve Profile buttons are not rendered (not just disabled) for non-`OWNER_CCO` sessions.

---

## 5. Layout Architecture

| Zone         | Width    | Contents                                                            | Scrollable  |
| ------------ | -------- | ------------------------------------------------------------------- | ----------- |
| Masthead     | 100%     | Firm name, CRD, risk badges, CCO, ADV date, AUM, action buttons     | No — sticky |
| Left panel   | 220px    | Firm posture ring, conflicts placeholder (Phase 1), source doc link | Yes         |
| Centre panel | Flexible | Never-suppress strip, disclosure controls grid                      | Yes         |
| Right panel  | 240px    | Rolling 30-day session metrics, suppression audit log               | Yes         |

CSS Grid: `grid-template-columns: 220px 1fr 240px`

**Effective viewport:** At 1280px with app sidebar (~240px), effective content width is ~1040px. All layout and AC viewport measurements use 1040px, not 1280px.

**Shell:** Renders inside existing `(app)` layout (`src/app/(app)/layout.tsx`). `AppSidebar` updated with cockpit nav item for `OWNER_CCO` and `MEMBER` only (hidden for `ADVISOR`).

---

## 6. Feature Requirements

### 6.1 Firm Masthead

- Firm name at 15px/500 on the left.
- CRD number in a muted badge.
- Risk classification badges (Dual-Hat Advisors, Regulatory History, etc.) in amber/red pill-style. Sourced from `FirmProfile.riskFlags` (string array). Editable in first-run wizard Step 1 and via `PATCH /api/workspaces/[workspaceId]/firm-profile` (include `riskFlags` in body) — not inline on the masthead.
- CCO name, ADV filing date, AUM as three right-aligned stat items.
- Approve Profile button (primary, `--color-brand-dark`). Examiner Preview button (secondary, Phase 2).
- Masthead sticky on scroll.

**Data source:** New `FirmProfile` model (§9.2).

### 6.2 Left Panel — Firm Posture & Context

#### 6.2.1 Firm Posture Ring

- SVG donut: suppressed (`--color-semantic-success`) / active (muted gray) / never-suppress (`--color-semantic-danger`) counts from `DisclosureCategory.status`.
- Centre number = suppressed count.
- Sub-text: "X of 12 categories covered by firm docs."

#### 6.2.2 Conflicts Section — Deferred to Phase 2

`FirmConflict` model and data source are unspecified. Phase 1 shows a placeholder callout:

> "Conflict tracking coming soon — review conflicts in meeting flags for now."

Full spec in Epic 8.1 addendum.

#### 6.2.3 Source Document

- ADV Part 2A: document icon, page count, CRD. Phase 1: link to `FirmProfile.advDocumentUrl` (CCO-supplied). Phase 2: upload + parse + inline viewer.

### 6.3 Centre Panel — Disclosure Controls

#### 6.3.1 Never-Suppress Attention Strip

- Full-width `--color-semantic-danger` strip at top of centre panel.
- Label: "Never-suppress — require verbal disclosure in every meeting" with `Lock` icon (lucide-react).
- Pills: Conflicts of Interest, Insurance Comp., Disciplinary History.
- Server component — reads static `src/lib/disclosure-categories.ts`. Always visible before grid scrolls.

> **Intentional redundancy:** Never-suppress categories also appear in Section 2 of the grid. The strip is the scan-path signal; the grid card provides ADV item context.

#### 6.3.2 Disclosure Controls Grid

12 categories in a 3-column grid, three sections:

**Section 1 — Core Disclosures** (suppressible)

- Fees & Compensation · `fees-compensation`
- Risk of Loss · `risk-of-loss`
- No Guarantee · `no-guarantee`
- Fiduciary Duty · `fiduciary-duty`
- Suitability · `suitability`
- Custody · `custody`

**Section 2 — Regulatory Requirements** (never-suppress, locked)

- Conflicts of Interest · `conflicts-of-interest`
- Insurance Comp. · `insurance-comp`
- Disciplinary History · `disciplinary-history`

**Section 3 — Operational & Conduct** (suppressible)

- Brokerage Practices · `brokerage-practices`
- Code of Ethics · `code-of-ethics`
- Referral Comp. · `referral-comp`

Slugs, display names, sections, never-suppress flags, and regex patterns defined in **`src/lib/disclosure-categories.ts`** — single source of truth for UI, flag mapping, and Prisma seed. See §7.4 for the pattern catalog.

#### 6.3.3 Disclosure Card — State Encoding (Phase 1: three states)

| State            | Top border token           | Icon (lucide-react) | Label            |
| ---------------- | -------------------------- | ------------------- | ---------------- |
| `ACTIVE`         | None (default border)      | `Circle`            | "Not suppressed" |
| `SUPPRESSING`    | `--color-semantic-success` | `CheckCircle2`      | "Suppressing"    |
| `NEVER_SUPPRESS` | `--color-semantic-danger`  | `XCircle` + `Lock`  | "Never suppress" |

Phase 2 adds `PARTIAL` (`--color-semantic-warning`, `AlertCircle`, "Partial coverage") — triggered by ADV parse, not manually settable by CCO.

#### 6.3.4 Disclosure Card — Contents

- Category name 12px/500. ADV item ref + page at 10px muted (empty until Phase 2 ADV parse). Description at 11px, max 2 lines.
- Toggle (suppressible) or `Lock` icon (never-suppress) top-right.
- Status indicator (icon + label — never colour alone) at card bottom.
- Toggling ON opens evidence modal before state commits (§7.1).

#### 6.3.5 Accessibility

- State communicated via colour border + icon + label (all three — not colour alone).
- `aria-label` on toggle: `"Toggle suppression for [category name] — currently [state]"`.
- `aria-disabled="true"` and `role="status"` tooltip on locked cards.
- `Lock` icon: `aria-hidden="true"` (decorative); screen reader reads label text.

### 6.4 Right Panel — Audit Log

#### 6.4.1 Session Metrics

- Two metric cards: Meetings Reviewed and Flags Total.
- **Scope: rolling 30-day window for the active workspace.** Consistent with `build-dashboard-summary.ts`. Not session-scoped until Phase 2.

#### 6.4.2 Suppression Log

- Live green CSS pulse dot in header while user has unsaved toggle state. Static once saved.
- Per entry: category name, timestamp, meeting context (if applicable), `action` (ACTIVATED / DEACTIVATED), `previousStatus` → `newStatus`.
- Left border: `--color-semantic-success` for ACTIVATED, neutral for DEACTIVATED.
- On Approve Profile, entries since last approval grouped under an approval marker row.
- **Source:** `SuppressionLogEntry` table — optimised for panel queries. `AuditEvent` is the compliance record and is written in parallel but not queried here.

### 6.5 First-Run / Empty State

When `FirmProfile` does not exist (or `status = DRAFT`) for the workspace:

**Step 1 — Firm details:** CRD, CCO name, AUM, ADV filing date, ADV URL (optional), risk flags (string array, comma-separated input). Submits to `POST /api/workspaces/[workspaceId]/firm-profile` with `status: DRAFT` — **server-side draft, not localStorage.** This ensures draft survives device and browser changes, and produces an audit trail for partial setup.

**Step 2 — Review categories:** Grid pre-populated with all 12 as `ACTIVE`. CCO may toggle suppressible items. Toggles in wizard require the same evidence modal as post-setup (§7.1). The never-suppress acknowledgement checkbox ("I understand Conflicts of Interest, Insurance Comp., and Disciplinary History require verbal disclosure in every client meeting") must be checked before submitting.

**On wizard submit:**

- `FirmProfile.status` updated to `ACTIVE`.
- 12 `DisclosureCategory` rows seeded (or updated if toggled).
- `SuppressionLogEntry` written for any ACTIVATED categories.
- `FirmProfileVersion` created with `type: INITIAL_SETUP` and `approvedAt = null`. This is a configuration snapshot, not a compliance attestation.
- CCO lands on the cockpit.

**Versioning clarification:** The wizard creates a `INITIAL_SETUP` version (configuration record). Formal compliance attestation requires the Approve Profile flow (§7.2), which creates an `APPROVED` version with confirmation checkbox and `AuditEvent`. These are distinct — see §9.2 for `versionType` enum.

> **Rationale for server-side draft over localStorage:** localStorage is lost on device/browser change, has no audit trail, and is unreliable for outsourced CCOs switching machines. Server draft with `DRAFT` status costs one extra model state and is consistent with compliance product expectations.

### 6.6 Error States

| Scenario                                                | UI behaviour                                                                                   |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| API failure on toggle                                   | Optimistic UI reverts; toast: "Could not save — try again." DB unchanged.                      |
| Toggle rejected (missing evidence)                      | Server returns 422; modal re-opens with inline error.                                          |
| API failure on Approve Profile                          | Modal stays open; inline error: "Approval failed. Changes not committed."                      |
| Concurrent edit (another session toggled same category) | On next fetch, card re-renders with server state; toast: "Profile updated by another session." |
| `FirmProfile` not found                                 | Redirect to first-run wizard.                                                                  |
| `FirmProfile.status = DRAFT`                            | Resume wizard from last completed step.                                                        |
| No meetings in last 30 days                             | Metrics show 0/0 with sub-text: "No meetings reviewed in the last 30 days."                    |

---

## 7. Interaction Behaviour

### 7.1 Toggle Suppression — Compliance Behaviour

**Primary behaviour: skip flag creation (not downgrade to INFO).**

When a category is `SUPPRESSING`, the refactored `detectMissingDisclosureFlags` (see §7.4) skips creating a `MISSING_DISCLOSURE` flag for that category on new and reprocessed meetings. The examiner narrative is "not applicable — covered in firm documentation."

**Evidence requirement (mandatory):**

Before a SUPPRESSING toggle is committed, a `Dialog` modal collects one of:

- Document reference: link to ADV section, client agreement, or marketing pack (e.g. "ADV Part 2A, Item 5, p.8–10").
- Rationale text: minimum 20 characters.

Evidence is validated **server-side** (Zod schema on the PATCH route — not client-side only). Server returns HTTP 422 if `suppressionEvidence` is absent or under 20 characters when `status = SUPPRESSING`. This mirrors the evidence field on `FlagResolutionType.DISCLOSED_ELSEWHERE`.

Stored on `DisclosureCategory.suppressionEvidence`. Surfaces in the suppression log, approval snapshot, and (Phase 2) Examiner Preview.

**Toggling OFF:**

- Sets status back to `ACTIVE`. Clears `suppressionEvidence`.
- Writes `SuppressionLogEntry` with `action: DEACTIVATED`.
- Does not retroactively create flags for past meetings.
- Does not affect manually remediated flags on existing meetings.

**Never-suppress:** No toggle. Clicking locked card shows `Tooltip`: "Regulatory requirement — verbal disclosure required in every client meeting." Button absent from DOM.

**Every toggle writes:**

1. `SuppressionLogEntry` (cockpit display log)
2. `AuditEvent` with action `DISCLOSURE_SUPPRESSION_ACTIVATED` or `DISCLOSURE_SUPPRESSION_DEACTIVATED`

### 7.2 Approve Profile

- Clicking Approve Profile opens a `Dialog`.
- Modal shows: X suppressed / Y active / Z locked, and a summary list of suppressed categories with their evidence references.
- CCO confirms with checkbox: "I confirm this disclosure profile reflects the firm's current ADV and compliance documentation."
- On confirm:
  - `FirmProfile.approvedAt` set; `approvedByUserId` set.
  - `FirmProfileVersion` created with `type: APPROVED`, immutable JSON snapshot of all category states + evidence.
  - `AuditEvent` written with `FIRM_PROFILE_APPROVED`.

**Post-approval mutability:** Any subsequent toggle clears `FirmProfile.approvedAt` (approval invalidated) and shows a banner: "Profile changes since last approval — re-approval required." Approval history is preserved in `FirmProfileVersion` records.

**Distinction from meeting sign-off:** Meeting CCO sign-off (`cco-signoff/route.ts`, `AuditAction.CCO_SIGNED_OFF`) is per-meeting. Profile approval is firm-level. The two are independent.

### 7.3 Examiner Preview — Phase 2

- Full-screen read-only overlay, labelled "Examiner View — read only."
- All toggles absent. Suppression log fully expanded. Never-suppress items highlighted with `--color-semantic-danger` border.
- Suppressed categories show evidence reference inline.
- Dismiss via Escape or close button.

### 7.4 Flag Engine Integration

> **Architecture clarification:** `detectMissingDisclosureFlags` today uses generic recommendation-centric patterns against nearby disclosures. It does not classify which ADV category failed. The integration model below preserves the existing missing-disclosure gate and adds profile-aware skip logic on top.

**Detection scope limitation (Phase 1):** The engine only evaluates **recommendations** — it flags when a recommendation lacks a qualifying nearby disclosure. It does not audit standalone ADV obligations that never appear as recommendations. The 12-category cockpit grid represents firm-level suppression policy; it does not expand detection to full Part 2A coverage. Set CCO expectations accordingly in onboarding copy.

**Current detection model:**

`detectMissingDisclosureFlags` in `src/server/flags/missing-disclosure.ts` today:

1. Iterates extracted recommendations (`ExtractedRecommendation[]`).
2. For each recommendation, checks whether any generic pattern matches the nearby disclosures.
3. If no match: candidate for a `MISSING_DISCLOSURE` flag (recommendation text in evidence).
4. Output: zero or more flags — not category-tagged.

**Required refactor — two-stage pipeline:**

Profile suppression is evaluated **after** the existing missing-disclosure determination, **not instead of it**. A recommendation that already has a valid nearby disclosure never enters the profile skip/raise decision.

```
For each recommendation:
  1. Run existing missing-disclosure check (nearby disclosure + generic patterns).
  2. If disclosure is valid → skip (no flag) — profile logic not applied.
  3. If disclosure missing/invalid → classify implicated category slugs from recommendation text.
  4. Apply profile rules (steps 5–7 below).
```

5. If any implicated category is `NEVER_SUPPRESS` → raise flag (profile cannot suppress).
6. If all implicated categories are `SUPPRESSING` → skip flag creation for this recommendation.
7. If mixed (`SUPPRESSING` + `ACTIVE`) → raise flag; include `"matchedCategories"` in `Flag.evidence` JSON.

> **NEVER_SUPPRESS clarification:** "Always raise" means the profile can never skip flag creation for that category — not that a flag is raised when the advisor already gave a valid nearby disclosure (step 2 still applies).

**Category patterns — single source of truth:**

All slugs, display names, sections, never-suppress flags, and regex patterns live in **`src/lib/disclosure-categories.ts`**. Export a typed catalog, e.g.:

```typescript
export type DisclosureCategoryDefinition = {
  slug: string;
  displayName: string;
  section: "core" | "regulatory" | "operational";
  neverSuppress: boolean;
  patterns: RegExp[]; // patterns to implement — not all exist in missing-disclosure.ts today
};
```

**`src/server/flags/category-mapping.ts`** imports from `disclosure-categories.ts` only — no duplicated regex lists. Functions:

- `getImplicatedCategorySlugs(recommendationText: string): string[]`
- `resolveProfileSkip(slugs: string[], profile: Map<string, DisclosureCategoryStatus>): "skip" | "raise" | "raise-mixed"`

| Category slug           | Patterns (defined in `disclosure-categories.ts`)                          | Never-suppress |
| ----------------------- | ----------------------------------------------------------------------- | -------------- |
| `fees-compensation`     | `/fees?/i`, `/compensat/i`, `/billing/i`, `/advisory fee/i`             | No             |
| `risk-of-loss`          | `/risk of loss/i`, `/may lose/i`, `/past performance/i`, `/principal/i` | No             |
| `no-guarantee`          | `/no guarantee/i`, `/not guaranteed/i`, `/cannot guarantee/i`           | No             |
| `fiduciary-duty`        | `/fiduciar/i`, `/best interest/i`, `/206/i`                             | No             |
| `suitability`           | `/suitabilit/i`, `/risk tolerance/i`, `/investment policy/i`            | No             |
| `custody`               | `/custod/i`, `/sloa/i`, `/fee deduction/i`                              | No             |
| `conflicts-of-interest` | `/conflict/i`, `/dual.hat/i`, `/rollover/i`, `/affiliate/i`             | **Yes**        |
| `insurance-comp`        | `/insurance commission/i`, `/non.cash/i`, `/bonus/i`, `/trip/i`         | **Yes**        |
| `disciplinary-history`  | `/disciplinar/i`, `/consent order/i`, `/sanction/i`, `/penalty/i`       | **Yes**        |
| `brokerage-practices`   | `/best execution/i`, `/soft dollar/i`, `/share class/i`                 | No             |
| `code-of-ethics`        | `/personal trading/i`, `/access person/i`, `/ipo pre.approv/i`          | No             |
| `referral-comp`         | `/referral/i`, `/promoter/i`, `/solicitor/i`                            | No             |

**Call-site blast radius:**

`detectMissingDisclosureFlags` is called in five places today. All five must pass workspace disclosure profile state:

| Call site              | File                                           | Flag reset behaviour on re-run                    |
| ---------------------- | ---------------------------------------------- | ------------------------------------------------- |
| Meeting processing job | `src/app/api/jobs/process-meeting/route.ts`    | **`deleteMany`** then `createMany` — see §7.5     |
| Manual reprocess       | `src/app/api/meetings/[id]/reprocess/route.ts` | **`deleteMany`** then `createMany` — see §7.5     |
| Transcript upload      | `src/app/api/upload/transcript/route.ts`       | **`createMany` only** — no delete before insert |
| Zoom ingest            | `src/app/api/jobs/zoom-ingest/route.ts`        | **`createMany` only**                             |
| Teams ingest           | `src/app/api/jobs/teams-ingest/route.ts`       | **`createMany` only**                             |

Each call site must resolve `FirmProfile` + `DisclosureCategory` statuses via `getDisclosureProfileForWorkspace(workspaceId)` in `src/server/firm-profile/get-disclosure-profile-for-workspace.ts` (lightweight cached read).

> **Ingest duplicate-flag note:** Upload and ingest routes append flags without deleting existing `MISSING_DISCLOSURE` rows first. That is pre-existing behaviour. Phase 1 should not regress it; optional follow-up: add idempotent upsert or delete-before-create on those paths.

**Multi-category flag resolution** (only when step 3 of the pipeline applies — disclosure missing):

| Scenario                              | Behaviour                                                          |
| ------------------------------------- | ------------------------------------------------------------------ |
| All matched categories `SUPPRESSING`  | Skip flag — no record created                                      |
| Any matched category `NEVER_SUPPRESS` | Raise flag — profile cannot suppress that category                 |
| Mixed (`SUPPRESSING` + `ACTIVE`)      | Raise flag — `Flag.evidence` includes `"matchedCategories": [...]` |
| No implicated slugs (no pattern match)| Raise flag — current behaviour (unclassified missing disclosure)   |
| No workspace profile (pre-setup)      | Raise flag for all missing disclosures — current behaviour         |

**Flag `evidence` JSON for mixed case:**

```json
{
  "recommendationText": "...",
  "matchedCategories": ["fees-compensation", "conflicts-of-interest"],
  "suppressedCategories": ["fees-compensation"],
  "activeCategories": ["conflicts-of-interest"],
  "suppressionEvidence": {
    "fees-compensation": "ADV Part 2A, Item 5, p.8–10"
  }
}
```

**Flag UI (`flags-panel.tsx`, Phase 1b):** When `matchedCategories` is present in `Flag.evidence`, display the primary category as the first non-suppressed slug (`ACTIVE` or `NEVER_SUPPRESS`). Suppressed matches shown as sub-note: "Fee disclosure suppressed per firm profile."

### 7.5 Reprocess + Remediation Edge Case

`process-meeting` and `reprocess` both delete `MISSING_DISCLOSURE` flags before recreating them. Upload and ingest routes only append flags (see §7.4 call-site table).

**Defined behaviour for Phase 1:**

| Scenario                                                                            | Behaviour                                                                                                                                                                                                 |
| ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Reprocess / job re-run after category suppressed                                    | New flags respect profile — suppressed categories skipped. Open unremediated flags deleted and recreated per profile rules.                                                                               |
| Reprocess / job re-run after flag manually remediated (`resolvedAt` set)            | Remediated flags **preserved** — `deleteMany` must exclude rows with non-null `resolvedAt`.                                                                                                               |
| Flag in `IN_REMEDIATION` or `PENDING_VERIFICATION` with `resolvedAt: null`          | **Deleted and recreated** on reprocess — intentional; re-run re-evaluates open compliance work.                                                                                                           |
| CCO toggles suppression after remediated flags exist                                | No change to remediated flags. Suppression applies on next detection run only.                                                                                                                            |
| CCO toggles suppression OFF and reprocesses                                         | Flags for the now-ACTIVE category recreated. Expected — CCO re-activated detection.                                                                                                                       |

**Required code change:** Apply the same `deleteMany` filter in **both** routes that delete before insert:

- `src/app/api/meetings/[id]/reprocess/route.ts`
- `src/app/api/jobs/process-meeting/route.ts`

```typescript
await db.flag.deleteMany({
  where: {
    meetingId,
    type: "MISSING_DISCLOSURE",
    resolvedAt: null, // preserve manually remediated flags (resolvedAt set by remediation routes)
  },
});
```

Ship with the flag engine refactor — not separately. AC-13 covers reprocess; add integration test for process-meeting job retry (§10.2).

### 7.6 Export / Audit Pack Impact

> **⚠️ Compliance impact:** Meeting audit packs exported via `src/server/export/pdf.ts` currently include all flags. After Phase 1, suppressed categories produce no flags — an examiner reading a meeting pack without profile context may see unexplained gaps.

**Phase 1b required behaviour:**

Every exported meeting pack must include a "Firm Disclosure Profile" section appended by the export layer:

- Profile version reference (see rules below).
- Table of **current live** suppressed categories with evidence references (from `DisclosureCategory`, not stale snapshot alone).
- Statement: "The following disclosure categories are suppressed at the firm level and are not flagged in individual meeting reviews."

**Version selection when exporting:**

| `FirmProfile` state                                      | Export section behaviour                                                                                                                                 |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| No `FirmProfile`                                         | Omit section entirely.                                                                                                                                   |
| Profile exists, never approved (`approvedAt` null)       | Include live category table + prominent warning: "Firm disclosure profile has not been formally approved." Reference latest `INITIAL_SETUP` version ID if present. |
| Profile approved (`approvedAt` set)                      | Include live category table + reference latest `FirmProfileVersion` where `versionType = APPROVED` (version ID, approval date, approving CCO name).     |
| Profile was approved but invalidated (toggle after approval) | Include live category table + warning: "Profile changed since last approval on [date] — re-approval pending." Still cite last `APPROVED` version for historical attestation. |

**Implementation:** Add `getFirmProfileSummaryForExport(workspaceId)` in `src/server/firm-profile/` called by the PDF export pipeline (`src/server/export/pdf.ts` and `src/server/export/index.ts`).

Ship in Phase 1b — same milestone as mixed-category flag UI (AC-17, AC-14).

---

## 8. Acceptance Criteria

| ID    | Criterion                                                                                                                                                                             |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC-01 | Never-suppress attention strip visible without scrolling at 1040px effective content width.                                                                                           |
| AC-02 | All three card states distinguishable by both colour border AND icon/label — not colour alone.                                                                                        |
| AC-03 | Conflicts placeholder ("coming soon" callout) renders in left panel without errors.                                                                                                   |
| AC-04 | Toggling SUPPRESSING without evidence text: client modal blocks; server returns HTTP 422 if evidence absent or < 20 chars.                                                            |
| AC-05 | Valid toggle writes both `SuppressionLogEntry` and `AuditEvent` within 500ms (optimistic UI confirmed on server response).                                                            |
| AC-06 | Clicking NEVER_SUPPRESS card shows tooltip; toggle button absent from DOM.                                                                                                            |
| AC-07 | Approve Profile modal lists suppressed categories with evidence references; confirmation checkbox required.                                                                           |
| AC-08 | Approving profile creates `FirmProfileVersion` with `type: APPROVED`; subsequent toggle clears `approvedAt` and shows re-approval banner.                                             |
| AC-09 | Masthead sticky — firm name, CCO, and AUM visible while scrolling centre panel.                                                                                                       |
| AC-10 | `MEMBER` role: nav item visible, cockpit readable, toggle and Approve Profile buttons absent from DOM.                                                                                |
| AC-11 | For recommendations that fail the existing missing-disclosure check: engine skips flag when all implicated categories are `SUPPRESSING`; raises when any implicated category is `NEVER_SUPPRESS` or mixed. Recommendations with valid nearby disclosures never flagged regardless of profile. Fixture test (§10.2). |
| AC-12 | Wizard submit creates `FirmProfile` (status: ACTIVE), 12 `DisclosureCategory` rows, `SuppressionLogEntry` for any toggled items, and `FirmProfileVersion` with `type: INITIAL_SETUP`. |
| AC-13 | Reprocess **and** `process-meeting` job retry preserve flags with non-null `resolvedAt`; open flags (`resolvedAt: null`) are deleted and recreated.                                                                                                  |
| AC-14 | Exported meeting pack includes Firm Disclosure Profile section per §7.6 version rules: live suppressed categories + evidence; warning when unapproved or invalidated.                                                                               |
| AC-15 | Server rejects `PATCH .../categories/[slug]` with `status: SUPPRESSING` and no `suppressionEvidence` — returns HTTP 422.                                                                                                                              |
| AC-16 | Category slugs and regex patterns defined only in `src/lib/disclosure-categories.ts`; `category-mapping.ts` imports from it (no duplicated pattern lists).                                                                                          |
| AC-17 | When `Flag.evidence.matchedCategories` is present, `flags-panel.tsx` shows primary non-suppressed slug and sub-note for suppressed matches.                                                                                                           |
| AC-18 | `ADVISOR` role: cockpit nav item hidden; direct navigation to `/compliance-cockpit` returns 403.                                                                                                                                                    |

---

## 9. Technical Notes

### 9.1 Stack

| Layer        | Technology                         | Notes                                                          |
| ------------ | ---------------------------------- | -------------------------------------------------------------- |
| Framework    | Next.js 15.2 App Router            | `src/app/(app)/` route group                                   |
| API          | REST route handlers                | `src/app/api/**/route.ts` — tRPC not used                      |
| ORM          | Prisma 6.6 → PostgreSQL            | Soft deletes via `deletedAt`                                   |
| Auth         | NextAuth 5 beta                    | Session in server components / route handlers                  |
| UI           | shadcn/ui (New York), lucide-react | `src/components/ui/`                                           |
| Styling      | Tailwind CSS 4                     | Tokens in `src/styles/globals.css`                             |
| Jobs         | Upstash QStash                     | Meeting ingest only — not required for suppression log Phase 1 |
| Client state | React hooks + server fetch         | No Zustand; server-first + optimistic UI                       |

### 9.2 Data Model

```prisma
enum DisclosureCategoryStatus {
  ACTIVE
  SUPPRESSING
  NEVER_SUPPRESS
  // PARTIAL — Phase 2 only
}

enum FirmProfileStatus {
  DRAFT
  ACTIVE
}

enum FirmProfileVersionType {
  INITIAL_SETUP   // created by wizard; not a compliance attestation
  APPROVED        // created by Approve Profile; formal attestation
}

model FirmProfile {
  id               String            @id @default(cuid())
  workspaceId      String            @unique
  status           FirmProfileStatus @default(DRAFT)
  crdNumber        String?
  ccoName          String?
  advFilingDate    DateTime?
  aumUsd           Decimal?
  advDocumentUrl   String?           // Phase 1: CCO-supplied URL
  advDocumentKey   String?           // Phase 2: object storage key
  riskFlags        String[]          // e.g. ["Dual-Hat Advisors"]
  setupCompletedAt DateTime?         // set when wizard finalises (status → ACTIVE)
  approvedAt       DateTime?         // cleared on any post-approval toggle
  approvedByUserId String?
  createdAt        DateTime          @default(now())
  updatedAt        DateTime          @updatedAt
  deletedAt        DateTime?

  workspace            Workspace              @relation(fields: [workspaceId], references: [id])
  disclosureCategories DisclosureCategory[]
  suppressionLogs      SuppressionLogEntry[]
  versions             FirmProfileVersion[]
}

model DisclosureCategory {
  id                  String                   @id @default(cuid())
  firmProfileId       String
  slug                String
  status              DisclosureCategoryStatus @default(ACTIVE)
  suppressionEvidence String?                  // required when status = SUPPRESSING
  advItemRef          String?
  advPage             Int?
  description         String?
  createdAt           DateTime                 @default(now())
  updatedAt           DateTime                 @updatedAt

  firmProfile FirmProfile @relation(fields: [firmProfileId], references: [id])
  @@unique([firmProfileId, slug])
}

model SuppressionLogEntry {
  id               String                    @id @default(cuid())
  workspaceId      String
  firmProfileId    String
  categorySlug     String
  userId           String
  meetingId        String?
  action           SuppressionAction
  previousStatus   DisclosureCategoryStatus?
  newStatus        DisclosureCategoryStatus
  evidenceSnapshot String?
  createdAt        DateTime                  @default(now())

  firmProfile FirmProfile @relation(fields: [firmProfileId], references: [id])
  @@index([firmProfileId, createdAt])
}

enum SuppressionAction {
  ACTIVATED
  DEACTIVATED
}

model FirmProfileVersion {
  id               String                 @id @default(cuid())
  firmProfileId    String
  workspaceId      String
  versionType      FirmProfileVersionType
  approvedByUserId String?                // null for INITIAL_SETUP
  approvedAt       DateTime               @default(now())
  snapshot         Json                   // immutable

  firmProfile FirmProfile @relation(fields: [firmProfileId], references: [id])
  @@index([firmProfileId, approvedAt])
  @@index([workspaceId])
}
```

> `FirmConflict` is not included — deferred to Phase 2 (Epic 8.1).
> DTOs in `src/lib/types.ts` — never expose raw Prisma objects to client.
> `DisclosureCategory` intentionally omits `deletedAt` — categories are config constants seeded from `src/lib/disclosure-categories.ts`, not user-created records. Deletion is not a valid operation.

### 9.3 API Routes

| Method | Path                                                           | Purpose                                                           |
| ------ | -------------------------------------------------------------- | ----------------------------------------------------------------- |
| GET    | `/api/workspaces/[workspaceId]/firm-profile`                   | Firm profile + categories + suppression log (paginated)           |
| POST   | `/api/workspaces/[workspaceId]/firm-profile`                   | Create profile draft (wizard Step 1)                              |
| PATCH  | `/api/workspaces/[workspaceId]/firm-profile`                   | Update masthead fields (CRD, CCO name, AUM, `riskFlags`, etc.)    |
| PATCH  | `/api/workspaces/[workspaceId]/firm-profile/categories/[slug]` | Toggle suppression (requires evidence; Zod-validated server-side) |
| POST   | `/api/workspaces/[workspaceId]/firm-profile/approve`           | Approve profile → `FirmProfileVersion` (APPROVED) + `AuditEvent`  |
| GET    | `/api/workspaces/[workspaceId]/firm-profile/suppression-log`   | Paginated `SuppressionLogEntry`                                   |

**`AuditAction` additions:**

- `DISCLOSURE_SUPPRESSION_ACTIVATED`
- `DISCLOSURE_SUPPRESSION_DEACTIVATED`
- `FIRM_PROFILE_APPROVED`

**Evidence validation:** Zod schema on `PATCH .../categories/[slug]`:

```typescript
z.object({
  status: z.enum(['ACTIVE', 'SUPPRESSING']),
  suppressionEvidence: z.string().min(20).optional(),
}).refine(
  (d) =>
    d.status !== 'SUPPRESSING' ||
    (d.suppressionEvidence && d.suppressionEvidence.length >= 20),
  { message: 'Evidence required when suppressing (minimum 20 characters).' },
);
```

**Dual log clarification:**

- `SuppressionLogEntry` — cockpit panel display, includes `evidenceSnapshot`, optimised for panel queries.
- `AuditEvent` — workspace-wide compliance record, included in exports.
- `FirmProfileVersion` — immutable point-in-time approval snapshot.
  All three written on Approve Profile. `SuppressionLogEntry` + `AuditEvent` written on every toggle.

### 9.4 UI Tokens

| Purpose                     | Token                      | Value     |
| --------------------------- | -------------------------- | --------- |
| Primary / approve button    | `--color-brand-dark`       | `#0d5c38` |
| Brand mid                   | `--color-brand-mid`        | `#1a9b5f` |
| Success / suppressing       | `--color-semantic-success` | `#22c55e` |
| Danger / never-suppress     | `--color-semantic-danger`  | `#ef4444` |
| Warning / partial (Phase 2) | `--color-semantic-warning` | `#d97706` |
| Muted text                  | `--color-text-muted`       | `#94a3b8` |

> PDF export (`src/server/export/pdf.ts`) uses `#0D2818` / `#2ECC71` for print. Cockpit UI uses tokens above. Do not unify until a dedicated brand token consolidation task is scheduled.

### 9.5 File Structure

```
src/app/(app)/compliance-cockpit/
  page.tsx                          ← server component; loads firm profile; 403 for ADVISOR
  loading.tsx
  error.tsx
src/components/compliance-cockpit/
  ComplianceCockpitClient.tsx
  FirmMasthead.tsx
  FirmPostureRing.tsx
  DisclosureGrid.tsx
  DisclosureCard.tsx
  SuppressionEvidenceModal.tsx
  SuppressionLogPanel.tsx
  ApproveProfileModal.tsx
  ExaminerPreviewOverlay.tsx        ← Phase 2
  ConflictsPanel.tsx                ← Phase 2
src/lib/disclosure-categories.ts    ← SINGLE SOURCE: slugs, names, sections, neverSuppress, patterns[]
src/server/flags/
  missing-disclosure.ts             ← refactor: two-stage pipeline (§7.4)
  category-mapping.ts               ← imports disclosure-categories.ts; resolveProfileSkip()
src/server/firm-profile/
  get-firm-profile.ts
  get-disclosure-profile-for-workspace.ts  ← lightweight cached read for flag engine
  toggle-category-suppression.ts
  approve-firm-profile.ts
  get-firm-profile-summary-for-export.ts   ← Phase 1b; PDF export pipeline
src/app/api/workspaces/[workspaceId]/firm-profile/
  route.ts
  categories/[slug]/route.ts
  approve/route.ts
  suppression-log/route.ts
```

### 9.6 Existing Enums to Reuse

- `FlagSeverity`: `INFO` | `WARN` | `CRITICAL`
- `FlagType`: `MISSING_DISCLOSURE` | `CONFLICT_LANGUAGE` | `MISSING_SUITABILITY_BASIS`
- `FlagResolutionType.DISCLOSED_ELSEWHERE` — conceptual neighbour; suppression skip is the firm-profile equivalent

---

## 10. Testing

Compliance-critical logic requires tests before Phase 1 merges to main. Use **vitest** for unit and integration tests.

### 10.1 Unit Tests

**`src/lib/disclosure-categories.ts` + `src/server/flags/category-mapping.ts`**

- Each slug matches its expected patterns; patterns are not duplicated outside `disclosure-categories.ts` (AC-16).
- Never-suppress slugs return `neverSuppress: true`.
- Multi-category recommendation text matches multiple slugs.
- Text with no matching pattern returns empty slug array.
- `resolveProfileSkip`: all SUPPRESSING → skip; any NEVER_SUPPRESS → raise; mixed → raise-mixed.

**`src/server/firm-profile/toggle-category-suppression.ts`**

- Rejects toggle to `SUPPRESSING` without `suppressionEvidence`.
- Accepts toggle with valid evidence; writes `SuppressionLogEntry` and `AuditEvent`.
- Toggle on `NEVER_SUPPRESS` category → throws; no DB write.

### 10.2 Integration Tests

**Flag engine + profile state (two-stage pipeline)**

Fixture: recommendation lacking nearby disclosure; text matches `fees-compensation` and `conflicts-of-interest`.

| Profile state                                                             | Expected result                                                                 |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| No `FirmProfile`                                                          | One flag raised                                                                 |
| `fees-compensation: SUPPRESSING`, `conflicts-of-interest: NEVER_SUPPRESS` | One flag raised; `matchedCategories` in evidence                                |
| Both `SUPPRESSING`                                                        | Zero flags raised                                                               |
| Both `ACTIVE`                                                             | One flag raised                                                                 |
| Valid nearby disclosure for recommendation (step 1 passes)                | Zero flags — profile logic not applied                                          |

**Reprocess and process-meeting preserve remediated flags**

Fixture: meeting with one open `MISSING_DISCLOSURE` flag and one with `resolvedAt` set. Run reprocess and process-meeting retry. Assert: remediated flag survives; open flag deleted and recreated per profile.

### 10.3 API Route Tests

**`PATCH .../categories/[slug]`**

- Returns 422 when `status: SUPPRESSING` and `suppressionEvidence` absent.
- Returns 422 when evidence present but < 20 chars.
- Returns 200 and writes both `SuppressionLogEntry` and `AuditEvent` on valid request.
- Returns 403 for `MEMBER` role.
- Returns 403 for `ADVISOR` role.
- Returns 400 when slug is a never-suppress category.

### 10.4 E2E (Cypress)

Deferred to Phase 1b unless bandwidth allows. Minimum happy path when implemented:

- `OWNER_CCO` completes wizard → toggles category with evidence → approves profile → banner on post-approval toggle.
- `MEMBER` sees cockpit read-only (no toggle in DOM).
- `ADVISOR` cannot reach `/compliance-cockpit`.

Document in test plan; not a Phase 1a merge blocker.

---

## 11. Open Questions (Remaining)

**Resolved in v1.3:** skip vs downgrade, evidence char minimum (server-side Zod), session metrics scope (30-day), conflicts panel (deferred), PARTIAL in MVP (deferred), examiner persona, post-approval mutability, wizard versioning, localStorage draft, riskFlags edit path, reprocess edge case, export impact.

**Resolved in v1.4:** call-site paths, profile-skip ordering, pattern single source of truth, process-meeting deleteMany filter, export version rules when approval invalidated, ADVISOR access, evidence validation server-side (both client modal and Zod on PATCH).

**Remaining:**

- Should erroneous never-suppress suppression attempts trigger a notification badge on the cockpit nav item via `src/app/api/notifications/`?
- ADV Part 2A parse strategy for Phase 2: upload + LLM extraction vs. SharePoint integration vs. manual page-ref entry only?
- Should `MEMBER` receive an in-app prompt to request CCO review when they spot a gap in the read-only cockpit?
- Should upload/ingest routes gain delete-before-create for idempotent flag generation (pre-existing duplicate-flag behaviour)?

---

## 12. Appendix — Design Audit Summary

| #   | v3 Issue                                 | v4 Resolution                                 | Priority   |
| --- | ---------------------------------------- | --------------------------------------------- | ---------- |
| 1   | Flat card grid — no state hierarchy      | Top-border colour + icon/label per card state | P0         |
| 2   | Never-suppress items at same weight      | Attention strip + locked Section 2 group      | P0         |
| 3   | Conflicts buried in sidebar, no severity | Deferred to Phase 2 with placeholder          | P1 Phase 2 |
| 4   | Suppression log competing with controls  | 240px right panel, below session metrics      | P1         |
| 5   | Firm header unstructured                 | Structured masthead with metadata grouping    | P1         |
| 6   | No category grouping rationale           | Three logical groups with labelled dividers   | P2         |
| 7   | Verbal disclosure notice buried          | Danger-colour attention strip                 | P2         |

---

## 13. Appendix — PRD Version Corrections

| Earlier claim                                                                   | v1.3 correction                                                                                                                        |
| ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| v1.2 §7.4 "current regex" patterns                                              | Patterns listed were targets, not existing code. v1.3 §7.4 labels them explicitly as "patterns to implement."                          |
| v1.2 §7.1 "existing open flags not retroactively altered" (no reprocess caveat) | v1.3 §7.5 defines reprocess behaviour; `deleteMany` filter change required.                                                            |
| v1.2 §6.5 wizard creates `FirmProfileVersion` / AC-12 conflicts with §7.2       | Resolved: wizard creates `INITIAL_SETUP` version (config record); Approve Profile creates `APPROVED` version (compliance attestation). |
| v1.2 §0 nav item OWNER_CCO only / §4.1 MEMBER can view                          | Resolved: nav visible to both; route guard enforces read-only for MEMBER.                                                              |
| v1.2 §1 "persistent conflict panel"                                             | Removed; conflicts deferred to Phase 2.                                                                                                |
| v1.2 §3.1 "conflict severity must be visually scannable"                        | Scoped to Phase 2.                                                                                                                     |
| v1.2 §6.5 localStorage wizard draft                                             | Replaced with server-side `FirmProfile.status = DRAFT`.                                                                                |
| v1.2 §6.1 riskFlags no edit path                                                | Added: editable in wizard Step 1 and forthcoming firm settings page.                                                                   |
| v1.2 §10 evidence char minimum listed as open question                          | Resolved: server-side Zod validation, 20-char minimum.                                                                                 |
| v1.2 `SuppressionLogEntry.action` as `String`                                   | Changed to `SuppressionAction` enum (`ACTIVATED` \| `DEACTIVATED`).                                                                    |
| v1.2 no `workspaceId` on `FirmProfileVersion`                                   | Added.                                                                                                                                 |
| v1.2 no `setupCompletedAt` on `FirmProfile`                                     | Added to distinguish wizard completion from formal approval.                                                                           |
| v1.3 §7.4 wrong call-site paths (3 of 5)                                        | v1.4: corrected to `upload/transcript`, `jobs/zoom-ingest`, `jobs/teams-ingest`; added deleteMany vs createMany column.               |
| v1.3 profile skip without missing-disclosure gate                               | v1.4 §7.4: two-stage pipeline — profile logic runs only after disclosure check fails.                                                |
| v1.3 patterns in both `disclosure-categories.ts` and `category-mapping.ts`      | v1.4: patterns only in `disclosure-categories.ts`; mapping imports it.                                                               |
| v1.3 §7.5 reprocess-only `deleteMany` fix                                       | v1.4: same filter applied to `process-meeting/route.ts`.                                                                             |
| v1.3 export "active version" undefined when approval invalidated                | v1.4 §7.6: version selection table (live state + warnings + last APPROVED reference).                                                |
| v1.3 Phase 1 undifferentiated scope                                             | v1.4 §3.3: split Phase 1a (core suppression) / Phase 1b (UI + export).                                                               |
| v1.3 ADVISOR role omitted                                                       | v1.4 §4.1 + AC-18: no nav, 403 on direct access.                                                                                     |
| v1.3 mixed-category UI unspecified in ACs                                       | v1.4 AC-17.                                                                                                                          |
| v1.3 "forthcoming firm settings page" for riskFlags                             | v1.4 §6.1: wizard Step 1 + `PATCH .../firm-profile`.                                                                                 |

---

_ComplyVault Ltd · complyvault.co · Compliance Cockpit PRD v1.4 · Confidential_
