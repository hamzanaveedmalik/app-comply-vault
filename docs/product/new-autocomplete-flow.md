---
tags:
  - product
  - prd
---

# ComplyVault — Product Requirements Document

**Product:** ComplyVault — Compliance Command Centre  
**Version:** 1.4  
**Status:** Draft — Grounded against codebase (31 May 2026)  
**Date:** 31 May 2026  
**Author:** Hamza Naveed, Founder — ComplyVault

> **Related:** CRD auto-population implementation detail lives in [`docs/product/autocomplete.md`](./autocomplete.md). This document is the master product PRD; the filename is historical.

**Changelog:**

- v1.0 — Initial spec (January 2026)
- v1.1 — Grounded against codebase; corrected stack assumptions
- v1.2 — Compliance Cockpit UX audit; resolved skip-vs-downgrade ambiguity; added category↔flag mapping; added suppression evidence requirement; phasing added
- v1.3 — Added Firm Disclosure Profile Setup flow (Steps 1 & 2); ADV Part 2A ingestion pipeline; CRD auto-population via sec-api.io; hardcoded Part 2A Item references as fallback; never-suppress lock logic; acknowledgement checkbox audit artefact; ADV version pinning model
- v1.4 — Grounded Epic 2 API routes, data models, and Step 1 lookup against as-built code; clarified static never-suppress vs risk-flag display; marked acknowledgement audit and ADV ref fallback gaps

---

## Table of Contents

1. [Overview](#1-overview)
2. [Architecture summary](#2-architecture-summary)
3. [Phasing](#3-phasing)
4. [Roles and permissions](#4-roles-and-permissions)
5. [Epic 1 — Meeting processing pipeline](#5-epic-1--meeting-processing-pipeline)
6. [Epic 2 — Firm disclosure profile setup](#6-epic-2--firm-disclosure-profile-setup)
7. [Epic 3 — Disclosure category configuration](#7-epic-3--disclosure-category-configuration)
8. [Epic 4 — ADV Part 2A ingestion](#8-epic-4--adv-part-2a-ingestion)
9. [Epic 5 — Flag engine and suppression](#9-epic-5--flag-engine-and-suppression)
10. [Epic 6 — Compliance Cockpit UI](#10-epic-6--compliance-cockpit-ui)
11. [Epic 7 — Tiered sign-off workflow](#11-epic-7--tiered-sign-off-workflow)
12. [Epic 8 — Integrations](#12-epic-8--integrations)
13. [Data models](#13-data-models)
14. [API contracts](#14-api-contracts)
15. [Open questions](#15-open-questions)
16. [Demo readiness — June 2](#16-demo-readiness--june-2)

---

## 1. Overview

ComplyVault converts client meeting recordings into SEC-ready audit documentation for Registered Investment Advisers (RIAs). It is built for the CCO, not the advisor. The core value proposition: every meeting produces a timestamped, evidence-linked audit pack that can be reviewed, approved, and exported — with every required disclosure checked automatically against the firm's ADV profile.

### Problem

RIAs are required to document client meetings, disclosures made, and suitability reasoning. Most do this manually or not at all. When the SEC examiner requests documentation, there is nothing there. The #1 source of SEC deficiency findings is missing or inconsistent meeting documentation.

### Solution

1. Meeting recording uploaded → transcribed → LLM extracts structured compliance data
2. Rule engine checks extracted data against firm's disclosure profile (derived from ADV)
3. Missing disclosures surface as flags → CCO reviews, approves, or suppresses with evidence
4. Audit pack exported — PDF compliance note, CSV evidence map, version history, transcript

### Target users

| User          | Role                                | Pain                                                    |
| ------------- | ----------------------------------- | ------------------------------------------------------- |
| CCO           | Primary — owns compliance programme | Manual documentation, exam exposure, personal liability |
| IAR / Advisor | Secondary — hosts client meetings   | No workflow change required                             |
| SEC Examiner  | Read-only persona                   | Needs clean, timestamped evidence trail                 |

---

## 2. Architecture summary

```
Recording upload
      ↓
Transcription (Deepgram / AssemblyAI)
      ↓
LLM structured extraction
      ↓
detectMissingDisclosureFlags() — TypeScript rule engine
      ↓
Flags: MISSING_DISCLOSURE | INFO (soft-suppressed with audit metadata)
      ↓
CCO review queue → sign-off workflow → audit pack export
```

**Stack:** Next.js · TypeScript · Prisma (PostgreSQL) · tRPC · Zustand · shadcn/ui (New York style) · Tabler icons · Deepgram / AssemblyAI · OpenAI / Anthropic

**Brand palette:**

- Primary green: `#2A7A4B`
- Dark: `#1A1A1A`
- Surface: `#F9F9F7`
- Border: `#E5E5E0`

---

## 3. Phasing

### Phase 0 — Vertical slice (June 2 demo ✓)

- [ ] Document upload
- [ ] LLM extraction
- [x] Firm profile configuration (Steps 1 & 2)
- [x] Soft suppression with audit trail
- [x] Examiner preview
- [x] Multi-layer sign-off

### Phase 1 — Pilot (June–July 2026)

- [ ] ADV Part 2A PDF ingestion (live parse replacing hardcoded fallback)
- [ ] Zoho One CRM integration
- [ ] Advisor-level profiles
- [ ] Full review queue with bulk actions

### Phase 2 — Scale (Q3 2026)

- [ ] Multi-firm command centre (partner CCO dashboard)
- [ ] Hadrius integration
- [ ] Zoom auto-ingest
- [ ] ComplyVault MCP server

---

## 4. Roles and permissions

| Action                 | Owner/CCO | Member/IAR | Read-only (Examiner) |
| ---------------------- | --------- | ---------- | -------------------- |
| Configure firm profile | ✓         | ✗          | ✗                    |
| Upload recording       | ✓         | ✓          | ✗                    |
| Review and edit draft  | ✓         | ✓          | ✗                    |
| Suppress a flag        | ✓         | ✗          | ✗                    |
| Sign off / finalise    | ✓         | ✗          | ✗                    |
| Export audit pack      | ✓         | ✗          | ✓                    |
| View interaction log   | ✓         | ✓          | ✓                    |

---

## 5. Epic 1 — Meeting processing pipeline

### CV-FEAT-001 · File upload

**As a** CCO  
**I want to** upload a meeting recording (MP3, MP4, WAV, M4A, ≤500MB)  
**So that** ComplyVault can process it into an audit pack

**Acceptance criteria:**

- AC-01: Accepted formats: MP3, MP4, WAV, M4A. Max size 500MB. Reject with clear error otherwise.
- AC-02: Upload progress shown. Status transitions: `UPLOADING → PROCESSING → DRAFT_READY`
- AC-03: Failed uploads show retry option. Partial uploads cleaned up server-side.
- AC-04: File stored with workspace-level tenant isolation.

### CV-FEAT-002 · Transcription

**As a** system  
**I want to** transcribe uploaded audio via Deepgram or AssemblyAI  
**So that** downstream extraction has a text input

**Acceptance criteria:**

- AC-01: Transcription triggered automatically on upload completion.
- AC-02: Speaker diarisation enabled where available.
- AC-03: Transcription failures logged to audit trail. CCO notified.
- AC-04: Transcript stored as immutable record; not editable by users.

### CV-FEAT-003 · LLM structured extraction

**As a** system  
**I want to** extract structured compliance fields from the transcript  
**So that** the rule engine has data to check against

**Extracted fields:**

- Topics discussed
- Recommendations made (product, rationale)
- Disclosures provided (verbatim, with timestamp)
- Decisions made
- Follow-up actions
- Client suitability signals

**Acceptance criteria:**

- AC-01: All fields extracted or explicitly marked as absent — no silent omissions.
- AC-02: Each extracted item linked to a transcript timestamp range (evidence link).
- AC-03: Extraction confidence scores stored for audit; not shown in UI by default.
- AC-04: Extraction runs asynchronously; CCO notified on completion.

---

## 6. Epic 2 — Firm disclosure profile setup

> **Status:** Step 1 and Step 2 UI complete. sec-api.io CRD lookup shipped (`GET /api/iapd/firm/[crd]`). ADV parse pending (see Epic 4). Disclosure cards still show `ADV ref — pending parse` until fallback refs are seeded — see §8 and §16.

### As-built vs target (Epic 2)

| Area | As-built today | Target (this PRD) |
| ---- | -------------- | ----------------- |
| CRD lookup | sec-api.io primary + public IAPD search fallback; auth-gated route | Same |
| CCO name | Best-effort from sec-api Schedule A direct owners; manual entry if absent | Same |
| Firm name | Read-only IAPD confirm line; persisted to `workspace.name` on Step 1 save | Same |
| Never-suppress categories | Three regulatory categories always locked in `DISCLOSURE_CATEGORY_CATALOG` | Optional future: lock driven by derived risk flags |
| Risk flags | Derived from ADV Part 1A; displayed as chips; editable | Inform CCO context; may drive locks in a later release |
| Acknowledgement checkbox | Required in UI before `Complete setup` | Persist dedicated `CCO_ACKNOWLEDGED_NEVER_SUPPRESS` audit event (not yet implemented) |
| ADV Item refs on cards | `advItemRef` null → UI shows pending parse | Hardcoded Part 2A Item fallback until Epic 4 parse |

### CV-FEAT-010 · Step 1 — Firm details

**As a** CCO  
**I want to** enter my firm's CRD number and have ComplyVault auto-populate firm details  
**So that** I don't have to manually enter data that is already public record

**Fields:**
| Field | Source | Required |
|---|---|---|
| CRD number | User input (`onBlur` trigger) | Yes |
| Firm name | IAPD confirm line (not a separate input); from lookup | Yes (via lookup or manual continue) |
| CCO name | sec-api Schedule A direct owners (best-effort); manual fallback | Yes |
| ADV filing date | sec-api.io auto-populated | No (soft warning if empty) |
| AUM (USD) | sec-api.io auto-populated | No (soft warning if empty) |
| ADV Part 2A URL | User input (`advDocumentUrl`, optional) | No |
| Risk flags | sec-api.io derived, user-editable chips | No |

**API call on CRD entry:**

```typescript
// Auth required — 401 if unauthenticated
GET /api/iapd/firm/141195

// Server: lookupFirmByCrdSecApi(crd) → lookupFirmByCrd(crd) fallback
// Response envelope (200):
{ success: true, data: IapdFirmLookupResult | null }

// IapdFirmLookupResult includes:
// crdNumber, firmName, secNumber, advFilingDate, aumUsd, employees,
// city, state, phone, ccoName, riskFlags[], source: 'sec-api' | 'iapd-search'
```

When `source === 'iapd-search'`, only firm name/CRD are reliable — UI shows a partial-data warning and AUM/filing date/flags must be entered manually.

**Risk flags returned by sec-api.io (for CRD 141195):**

- `Regulatory History`
- `Dual-Hat Advisors`
- `Insurance Affiliate`
- `Multi-State Adviser`
- `Pooled Vehicle Sponsor`

**Acceptance criteria:**

- AC-01: On valid CRD entry (`onBlur`), fire lookup via `useCrdLookup`. Show field spinners on auto-populated fields. Populate on success.
- AC-02: When `source === 'sec-api'`, show IAPD confirmation badge: `Sourced from SEC IAPD · CRD {n} · Last filed {date} · View on IAPD ↗`
- AC-03: If CRD not found (`data: null`), show inline status — do not block form; allow manual entry.
- AC-04: Risk flags render as colour-coded dismissible chips. User can add custom flags via `Add custom flag…` input.
- AC-05: `Continue` blocked until CRD number and CCO name are populated (client + server validation).
- AC-06: CRD must be numeric, 4–7 digits (`/^\d{4,7}$/`). ADV filing date and AUM are recommended but not required.
- AC-07: Step 1 save: `POST /api/workspaces/{workspaceId}/firm-profile` with `status: "DRAFT"`. When lookup succeeded, include `workspaceName: iapdFirm.firmName` to update `workspace.name`.
- AC-08: Demo mode (`NEXT_PUBLIC_DEMO_MODE=true`): enforce 800ms minimum perceived lookup delay. Client fetch timeout: 5 seconds.

**Never-suppress categories (as-built):**

Three regulatory categories are always `NEVER_SUPPRESS` in `src/lib/disclosure-categories.ts`:

- Conflicts of Interest
- Insurance Comp.
- Disciplinary History

These cannot be toggled in Step 2 or suppressed per-meeting. The flag engine respects `NEVER_SUPPRESS` status from the firm profile.

**Risk flags (informational today):**

| Risk flag             | ADV Part 1A signal | Display |
| --------------------- | ------------------ | ------- |
| `Regulatory History`  | Item 11.D.2 = Y    | Red chip |
| `Dual-Hat Advisors`   | Item 5.B.5 > 0     | Amber chip |
| `Insurance Affiliate` | Item 7.A.12 = Y    | Amber chip |
| `Multi-State Adviser` | Item 2.A.10 = Y    | Info chip |
| `Pooled Vehicle Sponsor` | Item 7.A.16 = Y | Amber chip |

> **Planned (not yet built):** dynamically lock only the categories implied by a firm's risk flags. Today all three regulatory categories are always locked regardless of flags.

---

### CV-FEAT-011 · Step 2 — Disclosure category configuration

**As a** CCO  
**I want to** review and configure which disclosure categories ComplyVault checks  
**So that** the rule engine reflects my firm's specific obligations

**Three sections:**

**1. Never-suppress bar (top)**
Rendered as a red banner listing the locked categories driven by risk flags from Step 1.

```
🔒 Never-suppress — require verbal disclosure in every meeting
[Conflicts of Interest] [Insurance Comp.] [Disciplinary History]
```

**2. Core Disclosures**

| Category            | ADV Part 2A ref | Description                                             | Default state |
| ------------------- | --------------- | ------------------------------------------------------- | ------------- |
| Fees & Compensation | Item 5          | Advisory fees, billing, compensation arrangements       | Off           |
| Risk of Loss        | Item 8          | Investment risk and potential for loss of principal     | Off           |
| No Guarantee        | Item 8          | No guarantee of investment performance or returns       | Off           |
| Fiduciary Duty      | Item 13         | Fiduciary status and obligations under Advisers Act     | Off           |
| Suitability         | Item 13         | Client suitability and investment policy considerations | Off           |
| Custody             | Item 15         | Custody arrangements, SLOA, fee deduction practices     | Off           |

**3. Regulatory Requirements** (locked — never suppress)

| Category              | ADV Part 2A ref | Description                                     | Lock reason (as-built)                       |
| --------------------- | --------------- | ----------------------------------------------- | -------------------------------------------- |
| Conflicts of Interest | Item 10         | Material conflicts requiring verbal disclosure  | Always `NEVER_SUPPRESS` in catalog           |
| Insurance Comp.       | Item 10         | Insurance commissions and non-cash compensation | Always `NEVER_SUPPRESS` in catalog           |
| Disciplinary History  | Item 9          | Disciplinary history and regulatory sanctions   | Always `NEVER_SUPPRESS` in catalog           |

**4. Operational & Conduct**

| Category            | ADV Part 2A ref | Description                                         | Default state |
| ------------------- | --------------- | --------------------------------------------------- | ------------- |
| Brokerage Practices | Item 12         | Best execution, soft dollars, share class selection | Off           |
| Code of Ethics      | Item 11         | Personal trading, access persons, IPO pre-approval  | Off           |
| Referral Comp.      | Item 14         | Referral arrangements, promoters, solicitors        | Off           |

**Acceptance criteria:**

- AC-01: Categories with `neverSuppress: true` render with lock icon and red border. Toggle is hidden/disabled.
- AC-02: Non-locked categories default to `ACTIVE` (suppression off). CCO can toggle to `SUPPRESSING` with mandatory evidence (min 20 chars via modal).
- AC-03: Each card shows: category name, ADV Part 2A Item reference (fallback when `advItemRef` is set; otherwise `ADV ref — pending parse`), description, suppression state.
- AC-04: Acknowledgement checkbox at bottom is required before `Complete setup`: `"I understand Conflicts of Interest, Insurance Comp., and Disciplinary History require verbal disclosure in every client meeting."`
- AC-05: **Gap — not yet implemented:** dedicated audit event on acknowledgement. Today the checkbox is UI-only; wizard completion writes `FirmProfileVersion` snapshot and suppression log entries for toggled categories.
- AC-06: On `Complete setup`, `PATCH /api/workspaces/{workspaceId}/firm-profile` with `{ neverSuppressAcknowledged: true, categoryToggles }` → seeds `DisclosureCategory` rows and sets profile `status: ACTIVE`.
- AC-07: Locked categories are static in the catalog; changing risk flags in Step 1 does not recalculate locks (see planned enhancement in §6 as-built table).

**ADV ref display — fallback behaviour:**
Until live ADV parse is complete (Epic 4), display hardcoded Part 2A Item references (table above). Do not show "pending parse". Show `Part 2A · Item {n}` as a link to `https://adviserinfo.sec.gov/firm/summary/{crdNumber}`.

---

## 7. Epic 3 — Disclosure category configuration (per-meeting)

### CV-FEAT-012 · Per-meeting disclosure check

**As a** CCO  
**I want to** see which required disclosures were made (or missed) in each meeting  
**So that** I can review, suppress, or escalate before finalising

**Rule engine behaviour:**

For each meeting, `detectMissingDisclosureFlags()` compares:

- Disclosures extracted from transcript
- Disclosures required by `FirmProfile` disclosure categories (configured in Epic 2)

Output per category:

- `PRESENT` — disclosure found in transcript with timestamp evidence
- `MISSING_DISCLOSURE` — required disclosure not found → surfaces as flag
- `INFO` — soft-suppressed (downgraded from MISSING_DISCLOSURE with audit metadata)

**Never-suppress enforcement:**
Categories marked `NEVER_SUPPRESS` in the firm profile cannot be soft-suppressed. Attempting suppression returns a 403. The UI hides the suppress action for these categories.

**Acceptance criteria:**

- AC-01: Rule engine runs automatically after LLM extraction completes.
- AC-02: `MISSING_DISCLOSURE` flags surface in review queue with evidence context.
- AC-03: CCO can suppress non-locked flags with a mandatory reason field (min 10 chars).
- AC-04: Suppression writes audit record: `{ flagId, suppressedBy, reason, timestamp, downgradeFrom: 'MISSING_DISCLOSURE', downgradeTo: 'INFO' }`.
- AC-05: Never-suppress categories: suppress action hidden in UI; 403 returned if called via API.
- AC-06: ADV filing date used to determine which version of disclosure requirements applies. Meetings before `advFilingDate` use prior ADV version.

---

## 8. Epic 4 — ADV Part 2A ingestion

> **Status:** Deferred post-demo. Hardcoded Item references active as fallback.

### CV-FEAT-020 · ADV Part 2A PDF fetch and parse

**As a** system  
**I want to** fetch and parse a firm's ADV Part 2A brochure from the SEC  
**So that** disclosure category cards show firm-specific section references rather than hardcoded fallbacks

**The problem with the IAPD URL:**
`https://files.adviserinfo.sec.gov/IAPD/Content/Common/crd_iapd_Brochure.aspx?BRCHR_VRSN_ID=1040146`

This URL returns an HTML wrapper page (ASPX), not a raw PDF stream. A direct fetch does not yield parseable content.

**Correct approach — server-side background job:**

```typescript
// Step 1: Get latest brochure version ID from IAPD API
const brochureRes = await fetch(
  `https://api.sec.gov/IAPD/api/v1/firm/${crdNumber}/brochures`,
);
const { brochures } = await brochureRes.json();
const latest = brochures[0];
const { brochureVersionId, filingDate } = latest;

// Step 2: Fetch PDF binary
async function fetchBrochurePdf(brochureVersionId: string): Promise<Buffer> {
  const url = `https://files.adviserinfo.sec.gov/IAPD/Content/Common/crd_iapd_Brochure.aspx?BRCHR_VRSN_ID=${brochureVersionId}&type=pdf`;
  const res = await fetch(url);
  return Buffer.from(await res.arrayBuffer());
}

// Step 3: Extract text from PDF
// Use: pdf-parse or pdfjs-dist (server-side)
const text = await extractTextFromPdf(pdfBuffer);

// Step 4: LLM maps sections to disclosure categories
const sections = await llmExtractAdvSections(text);
// Returns: { "Conflicts of Interest": "Item 10, p. 14", ... }

// Step 5: Store (planned — fields not yet on FirmProfile)
await db.firmProfile.update({
  where: { workspaceId },
  data: {
    advSections: sections,
    advParseStatus: 'PARSED',
    advParsedAt: new Date(),
  },
});
```

**ADV version pinning:**
`BRCHR_VRSN_ID` is tied to a specific filing. When `advFilingDate` changes (new ADV filed), the system must re-fetch and re-parse. Store `brochureVersionId` alongside `advFilingDate`. Trigger re-parse on `advFilingDate` change.

**Fallback behaviour (active until this epic is complete):**
Use hardcoded standard Part 2A Item references:

| Disclosure category   | Fallback ref      |
| --------------------- | ----------------- |
| Fees & Compensation   | Part 2A · Item 5  |
| Risk of Loss          | Part 2A · Item 8  |
| No Guarantee          | Part 2A · Item 8  |
| Fiduciary Duty        | Part 2A · Item 13 |
| Suitability           | Part 2A · Item 13 |
| Custody               | Part 2A · Item 15 |
| Conflicts of Interest | Part 2A · Item 10 |
| Insurance Comp.       | Part 2A · Item 10 |
| Disciplinary History  | Part 2A · Item 9  |
| Brokerage Practices   | Part 2A · Item 12 |
| Code of Ethics        | Part 2A · Item 11 |
| Referral Comp.        | Part 2A · Item 14 |

All fallback refs link to `https://adviserinfo.sec.gov/firm/summary/{crdNumber}`.

**Acceptance criteria:**

- AC-01: Parse job triggered as background task when firm profile setup completes and `advDocumentUrl` is present.
- AC-02: Parse status tracked: `PENDING | PARSING | PARSED | FAILED`.
- AC-03: On `PARSED`, disclosure category cards updated with firm-specific section + page references.
- AC-04: On `FAILED`, fallback hardcoded references remain active. Error logged. CCO not shown error state.
- AC-05: Re-parse triggered automatically when `advFilingDate` changes.
- AC-06: `brochureVersionId` stored alongside `advFilingDate` for audit trail.

---

## 9. Epic 5 — Flag engine and suppression

### CV-FEAT-030 · `detectMissingDisclosureFlags()`

Core rule engine. TypeScript deterministic function. Not an LLM call.

```typescript
type FlagSeverity = 'MISSING_DISCLOSURE' | 'INFO' | 'WARN';

interface DisclosureFlag {
  category: DisclosureCategory;
  severity: FlagSeverity;
  evidence: TranscriptEvidence | null;
  suppressedAt?: Date;
  suppressedBy?: string;
  suppressionReason?: string;
  neverSuppress: boolean;
}

function detectMissingDisclosureFlags(
  extraction: MeetingExtraction,
  profile: FirmDisclosureProfile,
): DisclosureFlag[];
```

**Five ingestion paths — all checked:**

1. Direct upload (MP3/MP4/WAV/M4A)
2. Zoom webhook auto-ingest (Phase 1)
3. Manual transcript paste
4. Email attachment ingest (Phase 2)
5. CRM-triggered ingest (Phase 2)

**Soft suppression model:**

- `MISSING_DISCLOSURE` → CCO provides reason → downgrades to `INFO` with audit metadata
- `INFO` flags remain in audit trail — they are not deleted
- Never-suppress categories: suppression blocked at rule engine level

---

## 10. Epic 6 — Compliance Cockpit UI

### CV-FEAT-040 · Three-panel layout

**Route:** `/compliance-cockpit`

**Panel 1 — Posture gauge**

- Overall compliance health score (0–100)
- Calculated from: flag rate, suppression rate, never-suppress miss rate, days since last review
- Colour-coded: green (80–100), amber (60–79), red (<60)

**Panel 2 — 12-category control grid**

- One card per disclosure category
- States: Active (checking) | Suppressed | Never-suppress (locked)
- Click opens examiner modal

**Panel 3 — Examiner modal**

- Triggered on card click
- Shows: category name, ADV ref, recent flag history, suppression audit trail
- Export: single-category evidence pack

### CV-FEAT-041 · Firm disclosure profile entry point

The Compliance Cockpit is the entry point for first-time firm setup. If no `FirmProfile` exists for the workspace (or required identity fields are missing):

- Show setup prompt: "Set up your firm's disclosure profile to activate the Compliance Cockpit"
- `Set up now` → Step 1 (CV-FEAT-010)

Once setup complete:

- Show cockpit with populated profile
- Show `Edit profile` link → returns to Step 1 in edit mode

---

## 11. Epic 7 — Tiered sign-off workflow

> **Status:** Complete (multi-layer sign-off feature shipped).

### Sign-off tiers

| Tier | Actor         | Action                                      |
| ---- | ------------- | ------------------------------------------- |
| 1    | IAR / Advisor | Self-certify: meeting documented accurately |
| 2    | Supervisor    | Review and approve advisor's documentation  |
| 3    | CCO           | Final sign-off — creates audit record       |

Each sign-off writes an immutable audit event with `userId`, `role`, `timestamp`, `ipAddress`.

**Acceptance criteria:**

- AC-01: Tier 3 (CCO sign-off) is the only action that moves status to `FINALISED`.
- AC-02: CCO cannot sign off if any `MISSING_DISCLOSURE` flag (non-suppressed) is present on a never-suppress category.
- AC-03: Sign-off emails sent to next tier on completion of each step.

---

## 12. Epic 8 — Integrations

### CV-FEAT-050 · Zoho One CRM integration

> **Status:** Pending. P0 for Phase 1.

**Purpose:** Sync finalised audit packs to Zoho CRM client records automatically.

**Fields to sync:**

- Meeting date, client name, advisor name
- Disclosures confirmed (checklist)
- Flag summary (count by severity)
- Link to full audit pack in ComplyVault

**Acceptance criteria:**

- AC-01: OAuth connection flow for Zoho One in Integrations settings page.
- AC-02: Auto-sync triggered on CCO sign-off (status → FINALISED).
- AC-03: Sync status visible on interaction log row.
- AC-04: Failed sync queued for retry (max 3 attempts). CCO notified on persistent failure.

### CV-FEAT-051 · Hadrius integration

> **Status:** Deferred to Phase 2.

Hadrius is declared as a recordkeeper in Janice's ADV Part 1. Integration would allow ComplyVault audit packs to be pushed directly into Hadrius as compliance records.

### CV-FEAT-052 · Zoom auto-ingest

> **Status:** Deferred to Phase 1. OAuth debugged (4711 error — stale token / scope mismatch resolved).

---

## 13. Data models

> **Source of truth:** `prisma/schema.prisma`. Firm name lives on `Workspace.name`, not `FirmProfile`.

### FirmProfile (as-built)

```prisma
model FirmProfile {
  id               String            @id @default(cuid())
  workspaceId      String            @unique
  status           FirmProfileStatus @default(DRAFT)  // DRAFT → ACTIVE on wizard complete
  crdNumber        String?
  ccoName          String?
  advFilingDate    DateTime?
  aumUsd           Decimal?
  advDocumentUrl   String?           // optional Part 2A URL from Step 1
  advDocumentKey   String?           // S3 key when uploaded
  riskFlags        String[]
  setupCompletedAt DateTime?
  approvedAt       DateTime?
  approvedByUserId String?
  createdAt        DateTime          @default(now())
  updatedAt        DateTime          @updatedAt
  deletedAt        DateTime?

  disclosureCategories DisclosureCategory[]
  suppressionLogs      SuppressionLogEntry[]
  versions             FirmProfileVersion[]
}

model DisclosureCategory {
  id                  String                   @id @default(cuid())
  firmProfileId       String
  slug                String                   // e.g. "conflicts-of-interest"
  status              DisclosureCategoryStatus @default(ACTIVE)
  suppressionEvidence String?
  advItemRef          String?                  // e.g. "Part 2A · Item 10" — null until Epic 4 or fallback seed
  advPage             Int?
  description         String?
  createdAt           DateTime                 @default(now())
  updatedAt           DateTime                 @updatedAt

  @@unique([firmProfileId, slug])
}

enum DisclosureCategoryStatus {
  ACTIVE           // checking — suppression off
  SUPPRESSING      // firm-level suppression active (evidence required)
  NEVER_SUPPRESS   // hard-locked regulatory category
}
```

Category slugs and `neverSuppress` defaults are defined in `src/lib/disclosure-categories.ts` (`DISCLOSURE_CATEGORY_CATALOG`).

### Planned fields (Epic 4 — not in schema yet)

```prisma
// Future additions to FirmProfile:
brochureVersionId   String?   // BRCHR_VRSN_ID from IAPD
advParseStatus      AdvParseStatus @default(PENDING)
advParsedAt         DateTime?
advSections         Json?     // { "Conflicts of Interest": "Item 10, p.14", ... }

enum AdvParseStatus { PENDING PARSING PARSED FAILED }
```

### Planned model (acknowledgement audit — not in schema yet)

```prisma
model NeverSuppressAcknowledgement {
  id             String   @id @default(cuid())
  firmProfileId  String
  userId         String
  categories     String[]
  acknowledgedAt DateTime @default(now())
  ipAddress      String?
}
```

---

## 14. API contracts

All firm-profile routes require auth and workspace membership. Write operations require CCO/owner role (`canWriteCockpit`).

### `GET /api/iapd/firm/[crd]` — CRD lookup (Step 1)

```typescript
// 200 — found or not found (null data is valid)
{ success: true, data: IapdFirmLookupResult | null }

// 400 — invalid CRD format
{ error: "Invalid CRD number" }

// 401 / 502
{ error: string }
```

Example `IapdFirmLookupResult` (CRD 141195, sec-api path):

```typescript
{
  crdNumber: "141195",
  firmName: "SECURE INVESTMENT MANAGEMENT, LLC",
  secNumber: "801-80752",
  advFilingDate: "2026-04-16",
  aumUsd: "42909330",
  employees: 31,
  city: "TUCSON",
  state: "AZ",
  phone: "520-333-4719",
  ccoName: "Janice Powell",       // from Schedule A direct owners when available
  riskFlags: [
    "Regulatory History",
    "Dual-Hat Advisors",
    "Insurance Affiliate",
    "Multi-State Adviser",
    "Pooled Vehicle Sponsor"
  ],
  source: "sec-api"
}
```

### `POST /api/workspaces/[workspaceId]/firm-profile` — Step 1 save (draft)

```typescript
// Request
{
  status: "DRAFT",
  crdNumber: string,
  ccoName: string,
  advFilingDate?: string,       // ISO datetime
  aumUsd?: string,
  advDocumentUrl?: string,
  riskFlags?: string[],
  workspaceName?: string        // set from IAPD lookup firm name
}

// Response (200)
{ success: true, data: { profile: FirmProfileDto } }
```

### `PATCH /api/workspaces/[workspaceId]/firm-profile` — Step 2 complete or profile edit

```typescript
// Wizard complete
{
  neverSuppressAcknowledged: true,
  categoryToggles?: Array<{
    slug: string,
    status: "ACTIVE" | "SUPPRESSING",
    suppressionEvidence?: string  // min 20 chars when SUPPRESSING
  }>
}

// Response (200)
{ success: true, data: CockpitBundleDto }
```

### `GET /api/workspaces/[workspaceId]/firm-profile` — read bundle

Returns profile, disclosure categories, suppression log, and `canWrite` flag.

---

## 15. Open questions

| #   | Question                                                                                                                                 | Owner             | Priority     |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------- | ----------------- | ------------ |
| 1   | Does sec-api.io reliably return Schedule A CCO name for all RIAs, or is manual entry common?                                             | Hamza             | P0           |
| 1b  | Does sec-api.io reliably derive `riskFlags[]` for all RIAs, or is field coverage inconsistent?                                            | Hamza             | P0           |
| 2   | IAPD `&type=pdf` parameter — does it return raw PDF stream consistently, or is ASPX wrapper always present?                              | Engineering       | P1           |
| 3   | Should ADV re-parse be triggered manually (CCO clicks "Re-parse") or automatically on `advFilingDate` change?                            | Hamza             | P1           |
| 4   | Multi-firm CCO (outsourced CCO serving 4 RIA clients): does each firm get its own `FirmProfile` per workspace, or is there a parent account? | Hamza             | P1           |
| 5   | Zoho One field mapping — which Zoho module (Contacts, Activities, Notes) receives the audit pack sync?                                   | Hamza + Zoho docs | P0 (Phase 1) |

---

## 16. Demo readiness — June 2

### Janice Powell · CCO · Secure Investment Management LLC · CRD 141195

**Completed ✓**

- [x] Step 1 — Firm details with CRD auto-populate (sec-api.io + IAPD fallback)
- [x] Step 1 — CCO name from Schedule A direct owners (best-effort)
- [x] Step 1 — IAPD source badge, field spinners, risk flag chips
- [x] Step 2 — Disclosure category configuration with never-suppress logic
- [x] Multi-layer sign-off
- [x] Soft suppression with audit trail
- [x] Examiner preview

**Required before demo**

- [ ] Replace `ADV ref — pending parse` with hardcoded `Part 2A · Item {n}` on category seed (see Epic 4 fallback table) — `DisclosureCard` still shows pending when `advItemRef` is null
- [ ] Link each ADV ref to `https://adviserinfo.sec.gov/firm/summary/141195`
- [ ] Seed CRD 141195 firm profile in demo environment with `advDocumentUrl` populated
- [ ] Set `SEC_API_KEY` in demo environment (without it, lookup falls back to partial IAPD data)
- [ ] Full end-to-end test with CRD 141195 — verify all fields, all flags, loading state, error states, partial fallback path

**Pending (acknowledge in demo, not blockers)**

- [ ] Firm-level flag training (Phase 1)
- [ ] Zoho One integration (Phase 1)
- [ ] Live ADV Part 2A parse (Phase 1)

### Demo script anchor

When Janice asks about "ADV ref — pending parse" (if fallback refs are not yet seeded):

> "Each disclosure category maps to a specific Item in your Part 2A brochure. For your filing from April 16th, the standard SEC Item references are shown here — Conflicts of Interest is Item 10, Disciplinary History is Item 9, and so on. During the pilot we'll parse your actual brochure PDF and show page-level references; today you can click through to your IAPD firm summary for the full filing."

When fallback refs are seeded (target state before demo):

> "These are the SEC Part 2A Item references for each disclosure category — aligned to your CRD 141195 filing. Click any reference to open your firm on IAPD. During the pilot we'll add page numbers from your live brochure parse."

---

_ComplyVault Ltd · Confidential · 31 May 2026_
