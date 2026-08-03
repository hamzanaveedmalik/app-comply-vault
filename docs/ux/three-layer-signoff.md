---
tags:
  - ux
  - prd
  - trust
---

# PRD: Three-Layer Meeting Sign-Off Workflow

**Author:** Hamza Naveed
**Date:** 18 May 2026
**Version:** 1.1
**Status:** Draft (aligned to repository schema & routes — see §14)
**Target demo:** 22 May 2026 (Janice Powell, Secure Income Management)

---

## 1. Overview

ComplyVault currently provides a single-layer review workflow where the CCO reviews all AI-generated compliance flags, resolves or accepts risks, and finalizes the meeting audit pack. Following feedback from Janice Powell (CCO, Secure Income Management), we are implementing a three-layer sign-off workflow that separates meeting accuracy certification, compliance flag triage, and CCO oversight into distinct approval stages with clear accountability boundaries.

### 1.1 Problem statement

In the current workflow, the CCO bears implicit responsibility for both the accuracy of the meeting record and the compliance review. This creates two issues:

- The CCO's sign-off is ambiguous — it is unclear whether they are attesting to what happened in the meeting or to the compliance posture of the meeting.
- The CCO is forced into operational flag triage on every meeting, including flags that a compliance manager could resolve without escalation.

This does not reflect how compliance teams actually operate. Advisors are responsible for what they said in the meeting. Compliance managers handle day-to-day flag review. The CCO provides oversight and handles escalated items requiring regulatory judgment.

### 1.2 Goals

- Separate meeting accuracy attestation (advisor) from compliance review (compliance manager) from regulatory oversight (CCO).
- Reduce CCO workload by routing only escalated flags to their queue.
- Create an unambiguous audit trail showing who signed off on what and when.
- Support batch approval for meetings with no escalations so the CCO can maintain oversight without per-meeting operational burden.

### 1.3 Non-goals

- Changing the AI flag generation logic (covered separately under firm-level flag training).
- Role-based access control beyond the three roles defined here (admin/org management is out of scope).
- Automated escalation rules (all escalation is manual in v1).

---

## 2. User Roles

| Role                   | Responsibility                                                         | Signs off on                                                        | Does NOT sign off on                                           |
| ---------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------- | -------------------------------------------------------------- |
| **Advisor**            | Reviews transcript for accuracy, corrects errors, adds context         | Meeting content accuracy: "This meeting happened as described"      | Compliance posture, flag resolution, regulatory adequacy       |
| **Compliance Manager** | Triages all AI-generated flags: resolve, add notes, or escalate to CCO | Flag triage completeness: "All flags reviewed, escalated as needed" | Meeting accuracy, final regulatory sign-off on escalated items |
| **CCO**                | Reviews escalated flags, provides final compliance sign-off            | Compliance review: "Regulatory review complete"                     | Meeting accuracy, routine flag resolution                      |

---

## 3. Meeting Status Lifecycle

**Naming (implementation):** Extend the existing Prisma `MeetingStatus` enum using the same `SCREAMING_SNAKE_CASE` convention as today (`UPLOADING`, `PROCESSING`, `DRAFT_READY`, …). The lifecycle below uses those canonical values — not ad hoc lowercase strings.

```
UPLOADING / PROCESSING → DRAFT_READY → ADVISOR_CERTIFIED → CM_REVIEWED → CCO_SIGNED_OFF → FINALIZED
```

(`UPLOADING` / `PROCESSING` are unchanged from the current pipeline; this document focuses on post–`DRAFT_READY` behaviour.)

| Status               | Set by                       | Description                                                                       | Editable by                     |
| -------------------- | ---------------------------- | --------------------------------------------------------------------------------- | ------------------------------- |
| `DRAFT_READY`        | System (after AI processing) | Transcript and flags generated. Awaiting advisor review.                          | Advisor (transcript only)       |
| `ADVISOR_CERTIFIED`  | Advisor                      | Advisor has reviewed and certified the transcript as accurate. Transcript locked. | Compliance Manager (flags only) |
| `CM_REVIEWED`        | Compliance Manager           | All flags resolved or escalated. CM sign-off recorded.                            | CCO (escalated flags only)      |
| `CCO_SIGNED_OFF`     | CCO                          | CCO has completed compliance review. Ready for finalization.                      | None                            |
| `FINALIZED`          | CCO / System                 | Read-only. Version-stamped. Audit pack exportable.                                | None (immutable)                |

Status transitions are strictly sequential. No status can be skipped. Reverting a status (e.g. CCO sends back to CM for further review) creates a new version entry in the audit trail but resets to the target status.

---

## 4. Detailed Workflow

### 4.1 Layer 1 — Advisor certification

**Trigger:** Meeting status is `DRAFT_READY`. Advisor receives a notification (email or in-app) that a meeting is ready for their review.

**Advisor view:**

- Full transcript with inline editing capability (correct names, figures, context).
- AI-extracted fields (topics, recommendations) displayed read-only for reference.
- Flags visible but not actionable — advisor can see what the system flagged but cannot resolve or dismiss flags.

**Certification action:** Advisor clicks "Certify meeting accuracy" which:

- Records advisor ID, timestamp, and IP address in the audit trail.
- Locks the transcript from further editing.
- Transitions meeting status to `ADVISOR_CERTIFIED`.
- Triggers notification to the assigned compliance manager.

**Certification statement:** "I confirm that this meeting record accurately reflects the discussion that took place. Any corrections have been made above."

### 4.2 Layer 2 — Compliance manager review

**Trigger:** Meeting status is `ADVISOR_CERTIFIED`. Meeting appears in the compliance manager's review queue with a visual indicator showing the advisor's certification timestamp.

**Compliance manager view:**

- Locked transcript (read-only, advisor's certification stamp visible at top).
- All AI-generated flags displayed with full context, evidence references, and confidence scores.
- Each flag has three action buttons:
  - **Resolve:** Flag is addressed. CM provides a resolution note (e.g. "Covered in firm ADV Part 2A", "Disclosure provided in onboarding pack").
  - **Add note:** CM adds context or documents an exception without fully resolving the flag (e.g. "Client was informed verbally; follow-up email pending").
  - **Escalate to CCO:** Flag requires CCO judgment. CM provides an escalation reason (required field).

**Completion action:** Once every flag has been actioned (resolved, noted, or escalated), the CM clicks "Complete review" which:

- Records CM ID, timestamp, and a summary of actions taken (X resolved, Y noted, Z escalated).
- Transitions meeting status to `CM_REVIEWED`.
- If any flags were escalated: meeting enters the CCO's escalation queue.
- If no flags were escalated: meeting enters the CCO's batch approval queue.

### 4.3 Layer 3 — CCO sign-off

#### 4.3.1 Escalated meetings

Meetings with escalated flags appear in the CCO's escalation queue, ordered by meeting date. The CCO sees:

- Advisor certification stamp and CM review summary at the top.
- Only escalated flags, with the CM's escalation reason displayed alongside each flag.
- Resolved and noted flags collapsed into a summary count (expandable if the CCO wants to inspect).

For each escalated flag, the CCO can:

- **Resolve:** CCO provides final resolution with a compliance note.
- **Create action item:** Generates a follow-up task assigned to the advisor or CM with a due date.
- **Accept risk:** CCO acknowledges the risk with documented rationale.

#### 4.3.2 Non-escalated meetings (batch approval)

Meetings where the CM resolved all flags without escalation appear in a batch approval view. This view shows:

- A summary table: meeting date, client name, number of flags, all resolved by CM.
- Each row is expandable to view the CM's resolution notes.
- A "Select all" checkbox and a "Sign off selected" button for batch approval.

The CCO can also click into any individual meeting for detailed review before approving.

**CCO sign-off statement:** "I have reviewed the compliance analysis for this meeting. This sign-off covers the regulatory review and does not attest to the accuracy of the meeting record, which was certified by the advisor."

#### Post sign-off

After CCO sign-off:

- Meeting status transitions to `CCO_SIGNED_OFF`.
- The "Finalize meeting" button becomes available, which locks the meeting as read-only and stamps the final version.
- The audit pack can now be exported with all three signatures.

---

## 5. Data Model Changes

**Baseline:** `prisma/schema.prisma` already defines `Meeting`, `Flag`, `UserWorkspace`, `WorkspaceRole`, `AuditEvent`, `ResolutionRecord`, `Verification`, and `MeetingStatus`. Prefer **extending** those types rather than introducing parallel models with different names.

### 5.1 `MeetingStatus` enum (extend)

Add values to the existing enum (after `DRAFT`, before or including `FINALIZED` as today):

- `ADVISOR_CERTIFIED`
- `CM_REVIEWED`
- `CCO_SIGNED_OFF`

Keep `FINALIZED` as the terminal state. Deprecate or narrow use of legacy `DRAFT` if it overlaps with `DRAFT_READY` for this workflow (see migration story in §15).

### 5.2 Meeting model — sign-off fields

Add optional timestamps and user FKs (mirror existing `finalizedBy` / `finalizedAt` pattern — use `User` relations, not duplicate string “By” names unless needed for denormalized audit display):

```prisma
model Meeting {
  // ... existing fields ...

  advisorCertifiedAt      DateTime?
  advisorCertifiedByUserId String?
  advisorCertifiedByUser   User?    @relation("MeetingAdvisorCertifiedBy", fields: [advisorCertifiedByUserId], references: [id])

  cmReviewedAt           DateTime?
  cmReviewedByUserId     String?
  cmReviewedByUser       User?     @relation("MeetingCmReviewedBy", fields: [cmReviewedByUserId], references: [id])

  ccoSignedOffAt         DateTime?
  ccoSignedOffByUserId   String?
  ccoSignedOffByUser     User?     @relation("MeetingCcoSignedOffBy", fields: [ccoSignedOffByUserId], references: [id])
}
```

(IP for certification should go into `AuditEvent.metadata`, not a column on `Meeting`, to match existing audit patterns.)

### 5.3 `Flag` model — CM/CCO triage vs remediation

**Current code:** `Flag` already has `status`, `resolutionType`, `resolutionNote`, `resolvedAt`, `resolvedByUserId`, and a linked `ResolutionRecord` with remediation tasks and `Verification` (CCO approve/reject). The PRD’s resolve / note / escalate / CCO actions **must be mapped** to this model (and optionally to `Verification`) so we do not maintain two competing workflows.

Recommended direction:

- Add enums or fields for **CM triage state** (e.g. `noted`, `escalated_to_cco`) distinct from **terminal flag closure**.
- Reuse or extend `FlagStatus`: e.g. treat `escalated` as `PENDING_VERIFICATION` (or a new status) until CCO acts.
- Store `escalationReason` on `Flag` or on `ResolutionRecord.metadata` / dedicated column.

Exact field list should be decided in implementation to avoid breaking existing `/api/flags/[id]/remediation` behaviour; see story **F-REMEDIATION-MAP** in §15.

### 5.4 Workspace roles (extend `WorkspaceRole`)

**Current code:** `WorkspaceRole` is only `OWNER_CCO | MEMBER`. UI maps `MEMBER` → “Compliance Manager” in `src/lib/workspace-display.ts` — there is **no advisor role** today.

**Target:** Extend `WorkspaceRole` (or add a separate functional-role table if product needs multiple roles per user). Minimum for v1:

- `ADVISOR` — certifies transcript; cannot finalize or manage workspace integrations.
- `COMPLIANCE_MANAGER` — CM layer (or keep `MEMBER` as CM and add `ADVISOR` only).
- `OWNER_CCO` — CCO layer + workspace admin (current owner).

Edge case §10.4 (CCO also CM): same user holds `OWNER_CCO` + `COMPLIANCE_MANAGER` (or equivalent), not a special case in status machine.

**Do not** add a redundant `WorkspaceUserRole` table unless product explicitly requires many-to-many roles per user beyond `UserWorkspace`.

### 5.5 Audit trail — extend `AuditEvent`

**Current code:** `AuditEvent` with `AuditAction` enum, `meetingId`, `metadata` JSON.

**Target:** Add `AuditAction` values (or use `metadata.action` consistently) for `ADVISOR_CERTIFIED`, `CM_REVIEW_COMPLETED`, `CCO_SIGNED_OFF`, `STATUS_REVERTED`, `FLAG_ESCALATED`, etc. Record IP in `metadata` where required for attestations.

Do **not** introduce a parallel `AuditTrailEntry` model unless there is a hard requirement — it duplicates `AuditEvent` and splits compliance evidence.

---

## 6. API surface (Next.js route handlers)

**Implementation style:** The app uses Next.js **Route Handlers** under `src/app/api/` (not a separate service). New mutations should follow existing patterns (`requireAppAccess`, Zod, Prisma `$transaction`, `AuditEvent`). Prefer `{ success: boolean, data?, error? }` response shapes for new endpoints.

Logical routes (exact file paths under `src/app/api/` may nest under `meetings/[id]/`):

### 6.1 Advisor certification

`POST /api/meetings/:id/certify` (or `certify-accuracy`)

- **Auth:** Workspace role includes advisor capability (see §5.4).
- **Precondition:** `Meeting.status === DRAFT_READY`.
- **Action:** Set `advisorCertifiedAt` + `advisorCertifiedByUserId`, transition to `ADVISOR_CERTIFIED`, `AuditEvent` (metadata: attestation, optional IP), notify CM.
- **Response:** `{ success: true, data: { meeting: … } }`

### 6.2 Flag triage (CM / CCO)

Extend **`POST /api/flags/[id]/remediation`** (existing) or add a dedicated triage handler — **do not** rely on deprecated `PATCH /api/flags/[id]/resolve` without aligning with remediation.

- **Auth:** CM for resolve / note / escalate; CCO for escalated items only.
- **Body (conceptual):**

```json
{
  "resolution": "resolved | noted | escalated | cco_resolved | cco_accepted_risk",
  "resolutionNote": "string (optional for resolved/noted, ignored for escalated)",
  "escalationReason": "string (required when resolution = escalated)"
}
```

- **Validation:** Must align with `FlagStatus`, `ResolutionRecord`, and `Verification` (see story **M-FLAG-MAP** in §15).

### 6.3 CM review completion

`POST /api/meetings/:id/cm-review`

- **Auth:** Compliance manager role.
- **Precondition:** `ADVISOR_CERTIFIED`; every flag has required triage state.
- **Action:** Set CM review fields, transition to `CM_REVIEWED`, `AuditEvent`, notify CCO.

### 6.4 CCO sign-off (individual)

`POST /api/meetings/:id/cco-signoff`

- **Auth:** CCO (`OWNER_CCO` today, or dedicated enum value).
- **Precondition:** `CM_REVIEWED`; no outstanding escalated flags.
- **Action:** Set CCO sign-off fields, transition to `CCO_SIGNED_OFF`, `AuditEvent`.

### 6.5 CCO batch sign-off

`POST /api/meetings/batch-cco-signoff`

- **Auth:** CCO.
- **Body:** `{ "meetingIds": ["id1", "id2"] }`
- **Precondition:** Each meeting `CM_REVIEWED` with zero active escalations.
- **Action:** Single transaction; per-meeting `AuditEvent`.

### 6.6 Status revert

`POST /api/meetings/:id/revert-workflow`

- **Auth:** CCO.
- **Body:**

```json
{
  "revertTo": "ADVISOR_CERTIFIED | CM_REVIEWED",
  "reason": "string (required)"
}
```

- **Action:** Update status, append `Version` / `AuditEvent`, notify CM or advisor.

### 6.7 Finalize (existing — behaviour change)

`POST /api/meetings/:id/finalize` currently allows `DRAFT_READY | DRAFT` for `OWNER_CCO`. **Target:** require `CCO_SIGNED_OFF` before finalize (optional feature flag during migration).

---

## 7. Permission Matrix

| Action                          | Advisor               | CM                    | CCO |
| ------------------------------- | --------------------- | --------------------- | --- |
| Edit transcript                 | ✓ (`DRAFT_READY` only) | ✗                    | ✗   |
| Certify meeting accuracy        | ✓                    | ✗                    | ✗   |
| Resolve / note / escalate flags | ✗                    | ✓                    | ✗   |
| Complete CM review              | ✗                    | ✓                    | ✗   |
| Resolve escalated flags         | ✗                    | ✗                    | ✓   |
| Sign off compliance review      | ✗                    | ✗                    | ✓   |
| Batch approve meetings          | ✗                    | ✗                    | ✓   |
| Revert meeting status           | ✗                    | ✗                    | ✓   |
| Export audit pack               | ✗                    | ✓ (target: post `CM_REVIEWED`) | ✓   |
| Finalize meeting                | ✗                    | ✗                    | ✓   |

**As-built (May 2026):** `WorkspaceRole` is only `OWNER_CCO` and `MEMBER`. `MEMBER` is labeled “Compliance Manager” in the UI. **Export** (`POST /api/meetings/:id/export`) allows any workspace member for `FINALIZED` or `DRAFT_READY` — not role-gated and not tied to CM/CCO workflow yet. **Flags:** remediation + CCO verification already exist in `flags-panel` / `remediation` for `MEMBER` and `OWNER_CCO`; the matrix above is the **target** after role split.

---

## 8. UI Changes

### 8.1 Meeting detail page

The meeting detail page adapts based on the viewer's role and the meeting's current status.

**Advisor view (status: `DRAFT_READY`):**

- Transcript section is editable with inline correction tools.
- Flags section is visible but grayed out with a label: "Compliance flags — pending review by compliance team."
- Bottom action bar shows: "Certify meeting accuracy" button with the attestation statement displayed above it.

**Advisor view (status: `ADVISOR_CERTIFIED` or later):**

- Transcript is read-only with a green banner: "Certified by [Advisor Name] on [date]".
- No further actions available to advisor on this meeting.

**Compliance manager view (status: `ADVISOR_CERTIFIED`):**

- Advisor certification banner displayed at top.
- Flags section is fully interactive with resolve / note / escalate actions.
- Progress indicator shows: "3 of 7 flags actioned."
- Bottom action bar shows: "Complete review" button (enabled only when all flags are actioned).

**CCO view (status: `CM_REVIEWED`, with escalations):**

- Advisor certification and CM review summary banners at top.
- Escalated flags section is prominent, with CM's escalation reasons visible.
- Resolved/noted flags collapsed under "Compliance manager resolved (X flags)" with expand toggle.
- Bottom action bar shows: "Sign off compliance review" button.

**CCO view (batch approval):**

- Accessed from the review queue, not the individual meeting page.
- Table of meetings with summary columns: date, client, flags count, CM actions summary.
- Checkbox selection with bulk "Sign off selected" action.

### 8.2 Review queue changes

The existing review queue sidebar item splits into role-specific views:

- **Compliance manager queue:** shows meetings in `ADVISOR_CERTIFIED` status, sorted by meeting date (oldest first).
- **CCO escalation queue:** shows meetings in `CM_REVIEWED` status that have escalated flags.
- **CCO batch approval queue:** shows meetings in `CM_REVIEWED` status with zero escalations.

### 8.3 Audit pack changes

The exported audit pack PDF must include a new "Sign-off summary" section at the top of the pack containing:

- Advisor name, certification timestamp, and attestation statement.
- Compliance manager name, review timestamp, and summary of flag actions.
- CCO name, sign-off timestamp, and attestation statement.
- A table of all flags with their final resolution status and notes.

---

## 9. Notifications

| Event                               | Recipient          | Channel              | Content                                                                |
| ----------------------------------- | ------------------ | -------------------- | ---------------------------------------------------------------------- |
| Meeting processed                   | Advisor            | Email + in-app       | "[Client] meeting ready for your review"                               |
| Advisor certified                   | Compliance Manager | Email + in-app       | "[Client] meeting certified by [Advisor], ready for compliance review" |
| Flags escalated to CCO              | CCO                | Email + in-app       | "[X] flags escalated on [Client] meeting — requires your review"       |
| CM review complete (no escalations) | CCO                | In-app (batch queue) | Added to batch approval queue                                          |
| Meeting reverted                    | CM or Advisor      | Email + in-app       | "[Client] meeting returned for further review: [reason]"               |

---

## 10. Edge Cases and Decisions

### 10.1 Advisor does not certify

If the advisor does not certify within a configurable period (default: 5 business days), the system sends a reminder. After two reminders, the compliance manager is notified so they can follow up directly. The meeting cannot progress without advisor certification.

### 10.2 CCO wants to review a non-escalated meeting in detail

The batch approval view allows the CCO to click into any individual meeting before approving. This click opens the full meeting detail with all CM resolution notes visible. The CCO can then approve individually or return to the batch view.

### 10.3 CCO disagrees with CM resolution

The CCO can revert a meeting to `CM_REVIEWED` status with a note explaining what needs to change. This creates a version history entry and sends the CM a notification. The CM's previous resolution notes are preserved but marked as "reverted."

### 10.4 Small firms where CCO is the only compliance person

Some firms (particularly smaller RIAs) have no compliance manager — the CCO does everything. In this case, the workspace is configured with the CCO also assigned the `compliance_manager` role. The workflow still enforces all three statuses, but the same person handles Layers 2 and 3. This preserves audit trail consistency across all firm sizes.

### 10.5 Meeting with zero flags

If the AI generates no compliance flags, the meeting still follows the full workflow. The CM's review step is simply a confirmation that zero flags is expected. This prevents a zero-flag meeting from being used to bypass review.

---

## 11. Success Metrics

- CCO time-per-meeting reduced by 60%+ (measured as time from `CM_REVIEWED` to `CCO_SIGNED_OFF` vs. current single-pass review time).
- 100% of finalized meetings have all three signatures in the audit trail.
- Escalation rate below 20% of total flags (indicating CM is handling routine items effectively).
- Advisor certification within 3 business days of meeting processing (measured at the 80th percentile).

---

## 12. Implementation Phases

### Phase 1 — Demo ready (target: 22 May 2026)

- Extend `MeetingStatus` with `ADVISOR_CERTIFIED`, `CM_REVIEWED`, `CCO_SIGNED_OFF` (plus existing `UPLOADING` / `PROCESSING` / `DRAFT_READY` / `FINALIZED`).
- Advisor certification UI and locking behaviour.
- CM flag triage UI with resolve / note / escalate actions.
- CCO escalation queue with individual sign-off.
- Updated audit pack export with three-signature summary.

### Phase 2 — Post-demo refinement

- CCO batch approval queue and bulk sign-off.
- Email notifications for status transitions.
- Revert flow with version history.
- Configurable reminder timelines for advisor certification.

### Phase 3 — Future iteration

- Role management UI (assign advisor / CM / CCO per workspace).
- Automated escalation rules based on flag type or severity.
- Dashboard analytics: escalation rates, review times, bottlenecks.

---

## 13. Open Questions

- Should the advisor be able to see the CM's flag resolutions and CCO's sign-off? Current assumption: yes (read-only), to close the loop.
- Should batch approval have a configurable auto-approve after N days if the CCO hasn't reviewed? Janice's input needed.
- What is the right default reminder cadence for advisor certification? Proposed: 3 business days, then 5 business days.
- Does the sign-off attestation language need legal review before deployment?

---

## 14. Codebase alignment snapshot (May 2026)

| PRD / concept | In repository today | Gap / action |
| ------------- | ------------------- | ------------ |
| Three meeting layers (advisor → CM → CCO) | Single path: `DRAFT_READY` → CCO **finalize**; `readyForCCO` flag | Add explicit statuses; gate finalize on `CCO_SIGNED_OFF` |
| `MeetingStatus` | `UPLOADING`, `PROCESSING`, `DRAFT_READY`, `DRAFT`, `FINALIZED` | Add enum values + migration; reconcile `DRAFT` vs `DRAFT_READY` |
| Advisor role | None; only `OWNER_CCO` / `MEMBER` | Extend `WorkspaceRole` + invitations + session `role` |
| CM vs Members | `MEMBER` displayed as “Compliance Manager” | Add real CM vs advisor distinction |
| Flag triage (resolve / note / escalate) | `Flag` + `ResolutionRecord` + `Verification` + remediation API | Map PRD actions to existing model; avoid parallel “simple resolve” API |
| Audit trail | `AuditEvent` + `Version` | Extend `AuditAction`; store IP in `metadata` |
| CCO batch sign-off | Not present | New route + UI queue |
| Export gate | `FINALIZED` or `DRAFT_READY` for any member | Tighten to regulatory states when workflow is enforced |
| `/api/flags/[id]/resolve` | Returns 410 / legacy disabled | Use remediation or new triage |
| Attestation PDF | “Advisor Sign-Off & Audit Trail” in `pdf.ts` | Add CM + CCO blocks + flag resolution table per §8.3 |

---

## 15. Groomed implementation stories

**Legend:** P0 = demo-blocking (22 May); P1 = soon after; P2 = Phase 3+.

### Epic A — Schema & migration

| ID | Story | Priority | Acceptance criteria (summary) |
| -- | ----- | -------- | ------------------------------ |
| **M-STATUS** | Extend `MeetingStatus` with `ADVISOR_CERTIFIED`, `CM_REVIEWED`, `CCO_SIGNED_OFF` | P0 | Prisma migration; `prisma generate`; existing meetings default safely (e.g. `DRAFT_READY` rows unchanged); dashboard / filters updated |
| **M-SIGNOFF-FIELDS** | Add `Meeting` FKs + timestamps for advisor / CM / CCO sign-off | P0 | Nullable fields; relations to `User`; backfill N/A for legacy |
| **M-ROLES** | Add workspace roles for advisor vs CM vs CCO | P0 | Extend `WorkspaceRole` (or documented alt.); invitations + `auth/config` session; `roleLabelForWorkspace` updated |
| **M-AUDIT** | New `AuditAction` values + logging for each transition | P0 | Every certification / CM complete / CCO sign-off / revert writes `AuditEvent`; no PII in error logs |

### Epic B — Server/API

| ID | Story | Priority | Acceptance criteria |
| -- | ----- | -------- | ------------------- |
| **A-CERTIFY** | `POST` certify accuracy | P0 | Only advisor; `DRAFT_READY` only; locks transcript edits; `ADVISOR_CERTIFIED` |
| **A-CM-COMPLETE** | `POST` complete CM review | P0 | All flags triaged; `CM_REVIEWED`; summary counts in audit metadata |
| **A-CCO-SIGNOFF** | `POST` CCO individual sign-off | P0 | Precondition: no open escalations; `CCO_SIGNED_OFF` |
| **A-FINALIZE-GATE** | Tighten `finalize/route.ts` | P0 | Accept only `CCO_SIGNED_OFF` (or flag-gated migration: allow legacy `DRAFT_READY` until cutover date) |
| **A-BATCH-CCO** | Batch CCO sign-off | P1 | Transaction; partial failure returns clear `error` |
| **A-REVERT** | Workflow revert | P1 | `Version` + `AuditEvent`; notifications stub or real per Phase 2 |
| **M-FLAG-MAP** | Map CM “noted / escalated / resolved” to `Flag` + remediation | P0 | Document mapping table; CCO escalation queue queries valid Prisma filters; existing remediation tests updated or replaced |

### Epic C — UI

| ID | Story | Priority | Acceptance criteria |
| -- | ----- | -------- | ------------------- |
| **U-ADVISOR-PAGE** | Advisor transcript edit + certify UX | P0 | Matches §8.1; flags read-only |
| **U-CM-PANEL** | CM flag triage + progress + complete | P0 | Matches §8.1; disabled until all flags actioned |
| **U-CCO-ESCALATION** | CCO escalation queue + detail | P0 | Escalated flags prominent; sign-off enables when valid |
| **U-QUEUES** | Sidebar / queues split by role | P1 | CM vs CCO escalation vs batch lists |
| **U-BATCH** | Batch approval table | P1 | Multi-select + sign-off |

### Epic D — Export & compliance artefacts

| ID | Story | Priority | Acceptance criteria |
| -- | ----- | -------- | ------------------- |
| **E-PDF-SIGNOFFS** | PDF “Sign-off summary” §8.3 | P0 | All three attestations + flag table; idempotent export |
| **E-ZIP-DATA** | CSV / payload parity if integrators consume export | P1 | Same facts as PDF sign-off block |

### Epic E — Notifications & polish

| ID | Story | Priority | Acceptance criteria |
| -- | ----- | -------- | ------------------- |
| **N-EMAIL** | Email + in-app §9 | P1 | At least in-app or email for certify + CM complete + escalate |
| **N-REMINDERS** | Advisor reminder cadence §10.1 | P2 | Configurable thresholds |

### Dependencies (order)

1. **M-STATUS**, **M-SIGNOFF-FIELDS**, **M-ROLES** → **A-*** routes  
2. **M-FLAG-MAP** in parallel with **U-CM-PANEL**  
3. **A-FINALIZE-GATE** after **A-CCO-SIGNOFF**  
4. **E-PDF-SIGNOFFS** after sign-off fields populated  

### Test checklist (minimum)

- Unit / integration: certify → CM complete (0 flags, N flags) → CCO sign-off → finalize happy path.  
- Error path: finalize blocked from `DRAFT_READY` when migration flag on.  
- RBAC: advisor cannot hit CM or CCO routes (403).

---
