# ComplyVault — Product Requirements Document

## CRD Auto-Population via SEC IAPD

| Field           | Value                                                                   |
| --------------- | ----------------------------------------------------------------------- |
| Feature ID      | CV-FEAT-007                                                             |
| Status          | In Development                                                          |
| Version         | 1.2                                                                     |
| Author          | Hamza Naveed, Founder & Owner/CCO                                       |
| Created         | 31 May 2026                                                             |
| Updated         | 31 May 2026 (v1.2 — resolved remaining spec inconsistencies)            |
| **Target Demo** | **Janice Powell, CCO — Secure Investment Management LLC — 2 June 2026** |
| Target Release  | 2 June 2026 (demo slice) · Full production: post-pilot                  |

---

## 0. Implementation Status

This section distinguishes what exists today from what must be built for the June 2 demo.

| Phase                    | Scope                                                                                                                                                            | Status       |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| **Phase A — Done**       | CRD `onBlur` trigger, public IAPD search confirm, auth-gated proxy at `src/app/api/iapd/firm/[crd]/route.ts`, CRD + CCO validation on Continue, returns `{ success: true, data: firm \| null }` | ✅ Complete  |
| **Phase B — Demo slice** | sec-api.io integration, full field auto-fill (AUM, filing date, city/state, phone), risk flag chip derivation, source badge, 800ms UX, IAPD fallback          | 🔴 Not built |

**Phase B is the critical path for June 2.** Phase A gives "Found in IAPD: SECURE INVESTMENT MANAGEMENT, LLC (ACTIVE)" — nothing else. Phase B delivers the demo moment in §9.

---

## 1. Overview

When a CCO begins setting up a firm disclosure profile in ComplyVault's Compliance Cockpit, they currently face a blank form: CRD number, CCO name, AUM, ADV filing date, and risk flags must all be typed manually. This creates friction, introduces data entry errors, and — critically — misses the most important first impression a compliance tool can make on a CCO prospect.

This feature replaces manual form entry with a single-field trigger. The user enters a CRD number (CCO name is pre-filled from workspace context). On blur, ComplyVault queries sec-api.io for live ADV Part 1A data and pre-populates AUM, filing date, and risk flags. Risk flags are derived automatically and surfaced with appropriate severity treatment.

The result is a moment that reframes the product: ComplyVault does not just store compliance data — it understands the RIA compliance universe from first principles, using the same source of truth an SEC examiner would pull on day one of an exam.

---

## 2. Problem Statement

### 2.1 User Pain

- CCOs managing multiple RIA clients already know their firms' CRD numbers — they use them constantly for IAPD lookups, state registrations, and examiner correspondence.
- Asking a CCO to manually re-enter firm name, AUM, and filing date that is publicly available in SEC records signals that ComplyVault has not done its homework.
- Manual entry introduces transcription errors that propagate into disclosure flags and audit documentation.
- The onboarding form is currently bypassable without any data entered — a validation gap this feature partially closes.

### 2.2 Demo Risk (June 2 — Janice Powell)

Janice Powell is the CCO of Secure Investment Management LLC (CRD 141195, Tucson AZ). She has been in the role since June 2025. The June 2 demo is ComplyVault's first live CCO demonstration.

The current Phase A state shows "Found in IAPD: SECURE INVESTMENT MANAGEMENT, LLC (ACTIVE)" and nothing else. AUM, ADV filing date, and risk flags remain empty manual fields. This is not the demo moment. Phase B must be complete before June 2.

---

## 3. Goals & Success Metrics

### 3.1 Goals

- Eliminate manual data entry for firm identity fields in the Compliance Cockpit setup flow.
- Derive and surface risk flags automatically from live ADV Part 1A data.
- Create a credibility moment in the demo that positions ComplyVault as a system that understands RIA compliance infrastructure, not just a form builder.
- Establish the sec-api.io integration as the foundation for all future ADV-driven features (pending parse resolution, examiner modal, posture gauge).

### 3.2 Success Metrics

| Metric     | Target                                                                                 |
| ---------- | -------------------------------------------------------------------------------------- |
| Demo       | Janice types CRD only; CCO name pre-filled from workspace context ("Janice Powell"); all other Step 1 fields auto-populate from IAPD |
| Demo       | Risk flags auto-populate with correct values matching her ADV (Regulatory History = Y)                                               |
| Technical  | API response + form population completes within 2 seconds on standard connection       |
| Quality    | Zero data entry errors vs. manually entered baseline                                   |
| Post-pilot | CCO setup time for Step 1 reduces from ~3 mins to under 30 seconds                     |

---

## 4. Scope

### 4.1 In Scope — Demo Slice (Phase B)

- Upgrade existing proxy route: sec-api.io primary, public IAPD fallback (see §5.1)
- Extend `IapdFirmLookupResult` in `src/lib/iapd-types.ts` with AUM, filing date, city/state, phone, 5 derived risk flags
- Preserve response envelope: `{ success: true, data: IapdFirmLookupResult | null }` on 200; `{ error: string }` on 400/401/502
- Form auto-population via `useCrdLookup` hook — accepts `useState` setters (Step 1 does not use React Hook Form)
- Firm name: read-only confirm line under CRD field + persist to `workspace.name` on Step 1 save (no new `FirmProfile` field)
- Replace text-only loading message with field spinners on auto-populated fields
- Add IAPD source badge with filing date and IAPD link
- Replace comma-separated risk flags text input with colour-coded chip component
- 800ms minimum perceived delay (demo-only — gate behind `NEXT_PUBLIC_DEMO_MODE=true`)
- 5-second client-side fetch timeout with inline error (see §6.5)

### 4.2 Out of Scope — Post-Pilot

- ADV Part 2A PDF ingestion and full disclosure text extraction
- Custodian auto-detection from Schedule D 5.K
- Individual IAR lookup (`/form-adv/individual`)
- Historical ADV filing comparison
- Automatic CCO name population (not in ADV Part 1 structured data — requires brochure parse)
- UK FCA equivalent (separate roadmap item)

---

## 5. Technical Architecture

### 5.1 API Strategy

**Decision:** sec-api.io primary for Phase B; public IAPD search as fallback.

| Option                                   | Pro                                                                                                    | Con                                                                                                                                     |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| **sec-api.io** (recommended for demo)    | Full ADV Part 1A structured data — AUM, filing date, all 5 risk flags. Matches §9 demo script exactly. | Requires paid API key, key management, cost (~$0.001/lookup).                                                                           |
| **Public IAPD search** (current Phase A) | Free, no key, already wired.                                                                           | Returns only firm name, CRD, disclosure flag. Cannot deliver AUM, filing date, or flag derivation. Demo script in §9 is not achievable. |

**Verdict:** sec-api.io is required to run the demo as scripted in §9.

**Fallback strategy (Phase B):**

1. **Primary:** sec-api.io `POST /form-adv/firm` — returns full ADV Part 1A shape.
2. **Fallback:** if sec-api.io returns no filing, times out, or returns 5xx, call existing public IAPD search (`lookupFirmByCrd` in `src/server/iapd/lookup-firm-by-crd.ts`). Map the partial result to `IapdFirmLookupResult` with `null` for AUM/date/flags and `source: 'iapd-search'`.
3. **Never expose** sec-api.io errors to the client — log server-side, return partial data or `{ success: true, data: null }`.

### 5.2 Existing Route — What to Upgrade

**Current path:** `src/app/api/iapd/firm/[crd]/route.ts`
**Current behaviour:** Calls `api.adviserinfo.sec.gov/search/firm`, returns `{ success: true, data: firm | null }`, requires auth (401 if unauthenticated).

**Phase B upgrade:** sec-api.io primary with public IAPD fallback. Preserve auth wrapper and response envelope.

### 5.2.1 Type — `IapdFirmLookupResult` (Phase B)

Replace the Phase A type in `src/lib/iapd-types.ts`:

```typescript
export type IapdFirmLookupResult = {
  crdNumber: string;
  firmName: string;
  secNumber: string | null;
  registrationScope: string | null;
  advFilingDate: string | null;   // ISO date string, e.g. "2026-04-16"
  aumUsd: string | null;          // raw numeric string, e.g. "42909330"
  employees: number | null;
  city: string | null;
  state: string | null;
  phone: string | null;
  riskFlags: string[];            // sorted: Regulatory History first, then others
  source: 'sec-api' | 'iapd-search'; // which upstream returned the data
};
```

Response envelope (unchanged):

```typescript
// 200 — found or not found
{ success: true, data: IapdFirmLookupResult | null }
// 400 / 401 / 502
{ error: string }
```

### 5.2.2 Route upgrade

```typescript
// src/app/api/iapd/firm/[crd]/route.ts  (Phase B upgrade)
// src/server/iapd/lookup-firm-by-crd-sec-api.ts — new sec-api.io mapper
// Keep existing auth check — do not remove

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ crd: string }> },
): Promise<Response> {
  const { crd } = await params;
  // ... existing auth check + CRD validation ...

  let firm = await lookupFirmByCrdSecApi(crd); // sec-api.io primary

  if (!firm) {
    firm = await lookupFirmByCrd(crd); // public IAPD fallback — partial shape
  }

  return Response.json({ success: true, data: firm });
}
```

sec-api.io mapper (inside `lookup-firm-by-crd-sec-api.ts`):

```typescript
const p = f.FormInfo.Part1A;

const riskFlags = [
  p.Item11D?.Q11D2 === 'Y' && 'Regulatory History',
  p.Item7A?.Q7A12 === 'Y' && 'Insurance Affiliate',
  Number(p.Item5B?.Q5B5) > 0 && 'Dual-Hat Advisors',
  p.Item7A?.Q7A16 === 'Y' && 'Pooled Vehicle Sponsor',
  p.Item2A?.Q2A10 === 'Y' && 'Multi-State Adviser',
].filter(Boolean) as string[];
// Regulatory History always first; remaining flags alphabetical

return {
  crdNumber: String(f.Info.FirmCrdNb),
  firmName: f.Info.BusNm,
  secNumber: f.Info.SECNb ?? null,
  registrationScope: null,
  advFilingDate: f.Filing[0]?.Dt ?? null,
  aumUsd: p.Item5F?.Q5F2C != null ? String(p.Item5F.Q5F2C) : null,
  employees: p.Item5A?.TtlEmp != null ? Number(p.Item5A.TtlEmp) : null,
  city: f.MainAddr?.City ?? null,
  state: f.MainAddr?.State ?? null,
  phone: f.MainAddr?.PhNb ?? null,
  riskFlags,
  source: 'sec-api',
};
```

### 5.3 Frontend Hook

**File path:** `src/hooks/useCrdLookup.ts`

Step 1 in `FirstRunWizard.tsx` uses plain `useState` — not React Hook Form. The hook accepts setter callbacks matching the existing pattern.

```typescript
type CrdLookupSetters = {
  setAdvFilingDate: (value: string) => void;
  setAumUsd: (value: string) => void;
  setRiskFlags: (flags: string[]) => void;
  setIapdFirm: (firm: IapdFirmLookupResult | null) => void;
  setIapdLookup: (status: 'idle' | 'loading' | 'found' | 'not_found' | 'error') => void;
};

export function useCrdLookup(setters: CrdLookupSetters) {
  const [error, setError] = useState<string | null>(null);

  const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';
  const MIN_DELAY = isDemoMode ? 800 : 0;
  const TIMEOUT_MS = 5000;

  const lookup = async (crd: string): Promise<void> => {
    const normalized = crd.trim();
    if (!/^\d{4,7}$/.test(normalized)) return;

    setters.setIapdLookup('loading');
    setters.setIapdFirm(null);
    setError(null);

    const start = Date.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const res = await fetch(`/api/iapd/firm/${encodeURIComponent(normalized)}`, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!res.ok) throw new Error('lookup_failed');

      const json = (await res.json()) as { success: boolean; data: IapdFirmLookupResult | null };
      if (!json.success || !json.data) {
        setters.setIapdLookup('not_found');
        return;
      }

      const firm = json.data;
      const elapsed = Date.now() - start;
      if (elapsed < MIN_DELAY) {
        await new Promise((r) => setTimeout(r, MIN_DELAY - elapsed));
      }

      // Firm name: displayed via setIapdFirm → read-only line under CRD field
      // Persisted to workspace.name on Step 1 save (see §5.4)
      setters.setIapdFirm(firm);
      setters.setAdvFilingDate(firm.advFilingDate?.slice(0, 10) ?? ''); // YYYY-MM-DD for type="date"
      setters.setAumUsd(firm.aumUsd ?? '');                             // raw string; format on display
      setters.setRiskFlags(firm.riskFlags);
      setters.setIapdLookup('found');
    } catch (err) {
      clearTimeout(timeoutId);
      if (err instanceof DOMException && err.name === 'AbortError') {
        setError('Unable to fetch firm data — please enter manually.');
      } else {
        setError(
          `No SEC-registered firm found for CRD ${normalized}. ` +
            `Please check and retry or enter details manually.`,
        );
      }
      setters.setIapdLookup('error');
    }
  };

  return { lookup, error };
}
```

**Step 1 save:** when `iapdFirm` is set, include `workspaceName: iapdFirm.firmName` in the POST body so the server updates `workspace.name` alongside `FirmProfile` fields.

### 5.4 Field Mapping — ADV to Form

| Form Field      | API Field Path          | Example Value (CRD 141195)        | Notes                                                                                                      |
| --------------- | ----------------------- | --------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Firm Name       | `Info.BusNm`            | SECURE INVESTMENT MANAGEMENT, LLC | **Read-only** confirm line under CRD field; persisted to `workspace.name` on Step 1 save (shown in masthead) |
| CRD Number      | `Info.FirmCrdNb`        | 141195                            | Trigger field — user entry                                                                                 |
| CCO Name        | —                       | Janice Powell                     | **Not in ADV Part 1.** Pre-fill from `initialDraft.ccoName` or workspace member context for demo          |
| SEC Number      | `Info.SECNb`            | 801-80752                         | Source badge display only                                                                                  |
| ADV Filing Date | `Filing[0].Dt`          | 2026-04-16                        | Slice to `YYYY-MM-DD` for `<input type="date">`                                                            |
| AUM (USD)       | `Part1A.Item5F.Q5F2C`   | 42909330                          | Store raw string in state; display formatted (e.g. `$42,909,330`) in source badge / demo narration          |
| Employees       | `Part1A.Item5A.TtlEmp`  | 31                                | Source badge display only                                                                                  |
| City / State    | `MainAddr.City + State` | TUCSON, AZ                        | Source badge                                                                                               |
| Phone           | `MainAddr.PhNb`         | 520-333-4719                      | Not a Step 1 field — available in lookup result for future use                                             |

### 5.5 Risk Flag Derivation Logic

| Risk Flag              | ADV Field       | Logic                               | UI Treatment                  |
| ---------------------- | --------------- | ----------------------------------- | ----------------------------- |
| Dual-Hat Advisors      | `Item5B.Q5B5`   | `Number(Q5B5) > 0` insurance-licensed employees | Amber chip                    |
| Insurance Affiliate    | `Item7A.Q7A12`  | `=== "Y"`                                       | Amber chip                    |
| Regulatory History     | `Item11D.Q11D2` | `=== "Y"` state regulator violation             | **Red chip — never suppress** |
| Pooled Vehicle Sponsor | `Item7A.Q7A16`  | `=== "Y"`                                       | Amber chip                    |
| Multi-State Adviser    | `Item2A.Q2A10`  | `=== "Y"` (15+ state registration)            | Info chip                     |

**Chip display order:** Regulatory History first (red), then remaining flags alphabetically. Matches §9.2 demo narration.

> **Confirmed for CRD 141195:** Regulatory History (`Item11D.Q11D2 = Y`) is present in Janice's current ADV. This maps to the Disciplinary History locked category on Step 2 — already never-suppressible. No additional configuration required.

---

## 6. UX Specification

### 6.1 Interaction Flow

1. User navigates to Compliance Cockpit → Firm disclosure profile setup (Step 1).
2. CCO name field shows pre-filled value from workspace context (demo: "Janice Powell").
3. User types CRD number into the CRD Number field.
4. On blur: spinner appears on auto-populated fields (AUM, ADV date, risk flags). Replace current text-only "Looking up firm in IAPD…" message.
5. After minimum delay (800ms in demo mode, 0ms otherwise): fields populate with live SEC data.
6. Firm name appears as read-only confirm line under CRD: `Found in IAPD: SECURE INVESTMENT MANAGEMENT, LLC · TUCSON, AZ`.
7. Source badge appears below populated fields: `Sourced from SEC IAPD · CRD 141195 · Last filed 2026-04-16`.
8. Risk flags auto-populate as chips (Regulatory History first). Replace current comma-separated text input.
9. All editable fields remain overridable before clicking Continue.

### 6.2 Loading State

- Spinner (16px, ComplyVault green `#1A3C2E`) appears inside each auto-populated field on trigger
- **Demo mode only (`NEXT_PUBLIC_DEMO_MODE=true`):** enforce 800ms minimum delay — instant population reads as hardcoded data
- **Production:** no artificial delay
- If API call exceeds 5 seconds: show inline error — "Unable to fetch firm data — please enter manually"

### 6.3 Source Badge

```tsx
<div className="iapd-badge">
  <ShieldCheck size={12} className="text-green-600" />
  <span>Sourced from SEC IAPD</span>
  <span className="separator">·</span>
  <span>CRD {firm.crdNumber}</span>
  <span className="separator">·</span>
  <span>Last filed {firm.advFilingDate}</span>
  <a
    href={`https://adviserinfo.sec.gov/firm/summary/${firm.crdNumber}`}
    target="_blank"
    rel="noopener noreferrer"
  >
    View on IAPD ↗
  </a>
</div>
```

- Font: 11px, color: `#6B7280`
- `ShieldCheck` from `lucide-react`
- "View on IAPD ↗" opens live IAPD profile — validates source authenticity in demo

### 6.4 Risk Flag Chips

- Replace the comma-separated text input with a chip component
- **Regulatory History:** red chip (`#FEE2E2` bg, `#991B1B` text)
- **Dual-Hat Advisors, Insurance Affiliate, Pooled Vehicle Sponsor:** amber chip (`#FEF3C7` bg, `#B45309` text)
- **Multi-State Adviser:** info chip (`#EFF6FF` bg, `#1D4ED8` text)
- Chips are removable (× button) — user can override derived flags
- Manual text input below chips for custom flags not in ADV

### 6.5 Error States

| Condition                      | Message                                                                                         |
| ------------------------------ | ----------------------------------------------------------------------------------------------- |
| CRD not found                  | "No SEC-registered firm found for CRD {crd}. Please check and retry or enter details manually." |
| API timeout (>5s)              | "Unable to fetch firm data — please enter manually." All fields remain editable.                |
| API key invalid / 401          | Silent fallback to manual entry. Log server-side. Do not expose to user.                        |
| Unauthenticated request        | Existing 401 from auth wrapper — no change needed                                               |
| CRD empty on Continue          | Block: "CRD number is required."                                                                |
| **CCO name empty on Continue** | **Block: "CCO name is required."** (aligns with `validateStep1Client` — not firm name)          |

---

## 7. User Stories & Acceptance Criteria

| #    | Story                                                                                                  | Acceptance Criteria                                                                              | Priority |
| ---- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ | -------- |
| US-1 | As a CCO, when I enter my firm's CRD number, I want the form to auto-populate with my firm's SEC data. | CCO name pre-filled from workspace; user types CRD only. AUM, date, flags populate within 2s. Values match IAPD for CRD 141195. Source badge visible. | **P0**   |
| US-2 | As a CCO, I want to see a loading indicator while firm data is being fetched.                          | Field spinners visible on AUM, date, and risk flag fields. 5s timeout shows inline error. No fields populate before spinners appear. | **P0**   |
| US-3 | As a CCO, I want risk flags derived automatically from my ADV filing.                                  | All 5 flag types derived correctly. Regulatory History chip present for CRD 141195.              | **P0**   |
| US-4 | As a CCO, I want to override any pre-populated field if the ADV data is outdated.                      | All auto-populated fields remain editable. Manual edits persist to Step 2.                       | P1       |
| US-5 | As a CCO, I want to see a link to the firm's IAPD profile to verify the source.                        | Source badge contains working link to `adviserinfo.sec.gov/firm/summary/{crd}`.                  | P1       |
| US-6 | As a CCO, if I enter an invalid CRD, I want a clear error message.                                     | Error message below CRD field. Form remains fully manually editable.                             | P1       |
| US-7 | As a CCO, I cannot proceed to Step 2 without CRD number and CCO name.                                  | Continue blocked if either field is empty. Aligns with `validateStep1Client`.                    | **P0**   |

---

## 8. Environment & Configuration

### 8.1 Environment Variables

```bash
# .env.local
SEC_API_KEY=<your_sec_api_io_key>        # Server-side only. Never expose client-side.
NEXT_PUBLIC_DEMO_MODE=true               # Set true for June 2 demo. Enables 800ms delay.
```

- `SEC_API_KEY` is only needed if upgrading to sec-api.io (Phase B). Current Phase A uses no key.
- Add both to Vercel environment variables before the demo deployment.
- **Rotate any previously exposed sec-api.io key before use.**

### 8.2 Caching

Current code uses `revalidate: 86400` on the fetch call — 24-hour Next.js cache, aligned with ADV daily update schedule (5–7:30am EST). No change needed for Phase B. Document in code comments.

### 8.3 Rate Limits & Cost

| Item               | Detail                                              |
| ------------------ | --------------------------------------------------- |
| sec-api.io pricing | ~$0.001 per firm lookup                             |
| Rate limit         | No aggressive limiting; SEC guideline is 10 req/sec |
| Demo cost          | Negligible — single lookup for CRD 141195           |

---

## 9. Demo Script — June 2, Janice Powell

> Internal only. Consider moving to `docs/demo-june-2.md` to keep confidential rehearsal notes out of the main engineering spec.

### 9.1 The Setup

- Navigate to Compliance Cockpit → Firm disclosure profile setup
- Step 1: CCO name already shows "Janice Powell" (pre-filled from workspace); all other fields empty
- Say: _"Let me show you how ComplyVault onboards a new client firm."_

### 9.2 The Moment

- Type `141195` into the CRD field (only field Janice types)
- Tab out — spinners appear on AUM, ADV date, and risk flags
- **Pause. Do not fill the silence.**
- Confirm line under CRD: `Found in IAPD: SECURE INVESTMENT MANAGEMENT, LLC · TUCSON, AZ`
- Fields populate: AUM `$42,909,330` · ADV date `2026-04-16`
- Source badge: `Sourced from SEC IAPD · CRD 141195 · Last filed 2026-04-16`
- Chips (in order): **Regulatory History** (red) · Dual-Hat Advisors (amber) · Insurance Affiliate (amber)

### 9.3 The Line

> _"ComplyVault pulls live from IAPD — the same database an SEC examiner opens on day one. Your firm's profile, AUM, and risk flags are already here. We just mapped them to your disclosure categories automatically."_

### 9.4 The Follow-Through

- Point to Regulatory History chip: _"This flag — Item 11D on your ADV — is a state regulatory finding. ComplyVault has pre-marked it as never-suppressible. Verbal disclosure required in every client meeting."_
- Click Continue → Step 2 loads with three locked categories highlighted
- _"These three — Conflicts of Interest, Insurance Compensation, Disciplinary History — ComplyVault will never allow a CCO to suppress. That is the floor."_

---

## 10. Open Questions

| Question                      | Status                                                                                                                                                              |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **CCO name pre-fill source**  | For demo: seed workspace with `ccoName: "Janice Powell"` in initial draft. Post-pilot: session user name or Part 2A brochure parse.                                 |
| **`workspace.name` on save**  | Step 1 POST must accept optional `workspaceName` and update `workspace.name` when IAPD lookup succeeds. Confirm API change in `firm-profile/route.ts`.             |
| **Partial fallback UX**       | When sec-api.io fails but public IAPD succeeds, show firm name confirm only — no spinner on empty fields. Message: "Partial IAPD data — enter AUM and filing date manually." |
| UK firms (FCA)                | Not in scope. FCA has no equivalent structured JSON API. Separate roadmap item.                                                                                     |

**Resolved in v1.2:**

- ~~`firmName` on `FirmProfile`~~ → read-only under CRD + persist to `workspace.name`
- ~~Response shape~~ → keep `{ success, data }` envelope
- ~~Auth on proxy~~ → preserved, documented in §5.2
- ~~800ms delay in production~~ → gated behind `NEXT_PUBLIC_DEMO_MODE`
- ~~Hook uses React Hook Form~~ → `useState` setters per §5.3

---

## 11. Implementation Timeline

| When           | Task                                                                                                                      |
| -------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Today — 31 May | Obtain and configure `SEC_API_KEY` in `.env.local` and Vercel. Rotate any previously exposed key.                         |
| Today — 31 May | Add `lookup-firm-by-crd-sec-api.ts`. Upgrade route: sec-api.io primary, public IAPD fallback. Verify CRD 141195.          |
| Today — 31 May | Extend `IapdFirmLookupResult` in `src/lib/iapd-types.ts` per §5.2.1.                                                      |
| Today — 31 May | Build `useCrdLookup` hook (§5.3). Wire into `FirstRunWizard` with `useState` setters.                                     |
| Today — 31 May | Add `workspaceName` to Step 1 POST; update `firm-profile/route.ts` to persist `workspace.name`.                           |
| Today — 31 May | Replace text loading message with field spinners. Wire `NEXT_PUBLIC_DEMO_MODE` delay and 5s timeout.                      |
| Today — 31 May | Replace comma-separated text input with chip component. Implement flag colour + sort order (§5.5).                       |
| Today — 31 May | Add source badge with IAPD link. Upgrade CRD confirm line to include city/state.                                            |
| 1 June AM      | Full end-to-end test: CRD 141195, all fields, all chips, badge, error states, auth flow, partial fallback.               |
| **1 June PM**  | **Demo rehearsal. Time the moment. Practice the line.**                                                                   |
| 2 June         | Demo — Janice Powell, Secure Investment Management LLC.                                                                   |

---

## 12. Related Work & Dependencies

- **CV-FEAT-001** — Firm disclosure profile setup flow _(prerequisite — complete)_
- **CV-FEAT-003** — Disclosure category configuration Step 2 _(prerequisite — complete)_
- **`docs/compliance-cockpit.md`** — Step 1/2 field definitions and never-suppress behaviour _(cross-reference for schema details)_
- **CV-FEAT-008** — ADV Part 2A PDF ingestion _(downstream — blocked on this feature)_
- **CV-FEAT-009** — Pending parse resolution across disclosure category cards _(downstream — this feature provides the data layer)_
- **CV-FEAT-010** — Compliance Cockpit posture gauge _(downstream — uses ADV-derived risk profile)_
- **sec-api.io account** — required for Phase B. Free tier available. Production requires paid plan.

---

## Changelog

| Version | Date        | Changes                                                                                                                                                                                                                                                                                                                                                                                                   |
| ------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1.0     | 31 May 2026 | Initial draft                                                                                                                                                                                                                                                                                                                                                                                             |
| 1.1     | 31 May 2026 | Reconciled against codebase review: added §0 implementation status, corrected route path to `src/app/api/iapd/firm/[crd]/route.ts`, preserved auth wrapper, fixed validation to CCO name not firm name, added `firmName` schema open question, gated 800ms delay behind env flag, aligned response envelope, added API strategy decision table (§5.1), updated status from "Approved" to "In Development" |
| 1.2     | 31 May 2026 | Resolved remaining inconsistencies: demo metric aligned with CCO pre-fill; locked `{ success, data }` envelope; IAPD fallback strategy (§5.1); Phase B type contract (§5.2.1); route uses `Promise<{ crd }>` params; hook rewritten for `useState` (§5.3); firm name → read-only CRD line + `workspace.name`; chip sort order; 5s timeout; updated §9 demo script, §10 open questions, §11 timeline |

---

_ComplyVault Ltd · Confidential · 31 May 2026_
