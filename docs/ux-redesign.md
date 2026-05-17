# PRD: Meeting Detail Page UX Redesign

**Author:** Hamza Naveed
**Date:** 18 May 2026
**Version:** 1.0
**Status:** Draft
**Depends on:** Three-Layer Sign-Off Workflow PRD v1.1
**Target demo:** 22 May 2026 (Janice Powell, Secure Income Management)

---

## 1. Overview

The meeting detail page is the primary working surface for all three roles in the sign-off workflow (advisor, compliance manager, CCO). The current implementation stacks all information with equal visual weight, separates flag triage from flag detail, and exposes role-inappropriate controls. This PRD defines the redesigned UX that makes each role's task immediately clear and reduces cognitive load during compliance review.

### 1.1 Problem statement

The current meeting detail page has five UX problems that directly impact usability:

- Information hierarchy is flat — the sign-off panel, flag triage, flag details, transcript, and extracted fields all have equal visual weight, forcing the user to scroll and scan to find their next action.
- Flag triage is disconnected from flag context — the CM sees a triage form (three text inputs per flag) in one section and the actual flag details (evidence, quotes, timestamps) in a separate "Requires Attention" section below. The CM has to mentally map between them.
- The triage input layout is inefficient — three side-by-side text areas per flag (resolve, note, escalate) waste space since only one is used per flag. This triples the visual noise.
- Role-inappropriate controls are visible — the CCO revert workflow is shown to the CM, and the CM triage section is shown to the CCO. This creates confusion about who is responsible for what.
- Status signals conflict — "Blocked: 3 critical flags open" and "Advisor certified" appear simultaneously, sending mixed messages about whether the meeting is stuck or progressing.

### 1.2 Design principles

- **One primary action per role per state.** The page should make it obvious what the current user needs to do next.
- **Context and action together.** Flag evidence, quotes, and triage controls live in the same card. No mental mapping.
- **Progressive disclosure.** Show what's needed now, collapse what's not. Transcript is collapsed after advisor certification. Resolved flags show a summary, not the full triage form.
- **Role-gated UI.** Each role sees only the controls they can act on. No disabled buttons for actions they can't take — just don't show them.

---

## 2. Page Structure

The page has four zones, rendered top-to-bottom. Zone content adapts based on the viewer's role and the meeting's current status.

| Zone                   | Content                                                | Behaviour                               |
| ---------------------- | ------------------------------------------------------ | --------------------------------------- |
| **Header card**        | Client name, meeting metadata, status badge            | Always visible, compact                 |
| **Workflow progress**  | Stepper (4 stages), certification banner, progress bar | Always visible, adapts to status        |
| **Flag workspace**     | Flag cards with integrated triage controls             | Role-gated actions, primary work area   |
| **Supporting content** | Transcript, extracted fields, version history          | Collapsed by default post-certification |

### 2.1 Key structural changes from current

| Current                                                  | Redesign                                                 | Reason                                           |
| -------------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------ |
| "Three-layer sign-off" passive card                      | Workflow stepper with visual progress                    | Command center, not a status label               |
| Separate triage form + "Requires Attention" flags        | Triage controls integrated into each flag card           | Context and action together                      |
| Three side-by-side text inputs per flag                  | Segmented control (resolve/note/escalate) + single input | Only one action per flag; 3x less noise          |
| "Blocked: X critical flags" banner                       | "Awaiting compliance review — X flags require triage"    | Reflects workflow progress, not a blocking error |
| Revert workflow visible to all roles                     | CCO-only, below flag workspace                           | Role-gated                                       |
| Transcript + extracted fields at full height             | Collapsed summary with expand toggle                     | CM doesn't need transcript front-and-center      |
| "Marked Ready for CCO" + "Finalize" as separate sections | Single "Complete compliance review" action bar           | One primary action per role                      |

---

## 3. Zone 1 — Header Card

### Layout

```
┌─────────────────────────────────────────────────────────┐
│ Robert & Susan Calloway              [Advisor certified]│
│                                                         │
│ Meeting date    4/24/2026    Type     Annual review      │
│ Advisor         James Hartwell       Firm    Meridian    │
└─────────────────────────────────────────────────────────┘
```

### Specifications

- Client name: 18px, weight 500, left-aligned.
- Status badge: top-right corner of card, pill style.
  - `DRAFT_READY`: amber background (#FAEEDA), amber text (#633806), label "Draft ready"
  - `ADVISOR_CERTIFIED`: green background (#E1F5EE), green text (#085041), label "Advisor certified" with check icon
  - `CM_REVIEWED`: blue background (#E6F1FB), blue text (#0C447C), label "CM reviewed"
  - `CCO_SIGNED_OFF`: green background (#E1F5EE), green text (#085041), label "CCO signed off"
  - `FINALIZED`: gray background (#F1EFE8), gray text (#444441), label "Finalized" with lock icon
- Metadata: 2-column grid, 13px, labels in tertiary color, values in weight 500.
- Card: standard border, border-radius-lg, 1rem 1.25rem padding.

---

## 4. Zone 2 — Workflow Progress

### 4.1 Stepper

A horizontal 4-step progress indicator showing the meeting's position in the sign-off workflow.

```
[ ✓ Advisor certified ] → [ ● CM review ] → [ 3 CCO sign-off ] → [ 4 Finalized ]
       done                    active              pending              pending
```

**Step states:**

| State   | Dot style                                               | Label colour         | Bottom border         |
| ------- | ------------------------------------------------------- | -------------------- | --------------------- |
| Done    | Green background (#E1F5EE), check icon, green (#0F6E56) | Dark green (#085041) | Solid green (#0F6E56) |
| Active  | Blue background (#E6F1FB), clock icon, blue (#185FA5)   | Dark blue (#0C447C)  | Solid blue (#185FA5)  |
| Pending | Secondary background, step number in tertiary           | Tertiary text        | Tertiary border       |

**Step labels map to statuses:**

| Step | Label             | Active when status is               |
| ---- | ----------------- | ----------------------------------- |
| 1    | Advisor certified | `DRAFT_READY` (advisor's turn)      |
| 2    | CM review         | `ADVISOR_CERTIFIED` (CM's turn)     |
| 3    | CCO sign-off      | `CM_REVIEWED` (CCO's turn)          |
| 4    | Finalized         | `CCO_SIGNED_OFF` (CCO can finalize) |

### 4.2 Certification banner

Displayed below the stepper once the advisor has certified. Green background (#E1F5EE), 13px, with check-circle icon.

Content: "Certified by [Advisor Name] on [date] at [time]"

### 4.3 Progress bar (CM view only)

Displayed when the meeting status is `ADVISOR_CERTIFIED` and the viewer is a compliance manager.

```
[████████░░░░░░░░░░░░░░]  1 of 3 flags triaged
```

- Bar: 6px height, secondary background, blue fill (#185FA5).
- Text: 13px, secondary colour, right of bar.
- Updates dynamically as flags are triaged.
- Fill percentage = (triaged flags / total flags) \* 100.

---

## 5. Zone 3 — Flag Workspace

This is the primary work area. Each compliance flag renders as an independent card with integrated triage controls. The exact controls shown depend on the viewer's role and the flag's current state.

### 5.1 Flag card structure

```
┌─────────────────────────────────────────────────────────┐
│ [CRITICAL] [MISSING DISCLOSURE] [OPEN]                  │
│                                                         │
│ Advisor should model before making a recommendation     │
│                                                         │
│ │ "I want to model that out more carefully before       │
│ │  making a recommendation."                            │
│                                                         │
│ ⏱ Timestamp 6:30 · Confidence 85%                      │
│                                                         │
│ ─────────────────────────────────────────────────────── │
│ [ ✓ Resolve ] [ 📝 Note ] [ ↑ Escalate ]               │
│                                                         │
│ [Resolution note (min 10 chars)...              ]       │
│                                                         │
│ [Resolve flag]                                          │
└─────────────────────────────────────────────────────────┘
```

### 5.2 Flag card elements

**Header row:** Horizontal badge row.

- Severity badge: "Critical" = red background (#FCEBEB), red text (#791F1F). "Warning" = amber background (#FAEEDA), amber text (#633806).
- Type badge: gray background (secondary), secondary text. Content from flag type field (e.g. "Missing disclosure", "Suitability concern").
- Status badge:
  - "Open" = amber background (#FAEEDA), amber text (#633806)
  - "Resolved" = green background (#E1F5EE), green text (#085041), with check icon
  - "Noted" = blue background (#E6F1FB), blue text (#0C447C)
  - "Escalated" = amber background (#FAEEDA), amber text (#633806), with arrow-up icon

**Recommendation text:** 14px, weight 500. The AI-generated recommendation or concern description.

**Evidence quote:** 13px, italic, secondary colour, left border (2px tertiary, no border-radius). The verbatim transcript excerpt that triggered the flag.

**Evidence metadata:** 12px, tertiary colour. Timestamp link + confidence percentage. Clicking timestamp scrolls to that point in the transcript (when expanded).

**Triage controls:** Below a 0.5px divider. Only shown for the active role. See §5.3.

### 5.3 Triage controls by role and state

#### CM view — flag is open (status: `ADVISOR_CERTIFIED`)

**Segmented control:** Three tabs in a horizontal group.

- "Resolve" (check icon) — default selected, blue highlight (#E6F1FB border, #0C447C text)
- "Note" (note icon) — blue highlight when selected
- "Escalate" (arrow-up icon) — amber highlight when selected (#FAEEDA border, #633806 text)

Only one tab active at a time. Selecting a tab:

- Updates the text input placeholder.
- Updates the submit button label and colour.

| Tab selected | Placeholder text                                   | Button label      | Button colour                    |
| ------------ | -------------------------------------------------- | ----------------- | -------------------------------- |
| Resolve      | "Resolution note (min 10 chars)..."                | "Resolve flag"    | Green (#E1F5EE bg, #085041 text) |
| Note         | "Add context or document an exception..."          | "Add note"        | Blue (#E6F1FB bg, #0C447C text)  |
| Escalate     | "Why does the CCO need to weigh in? (required)..." | "Escalate to CCO" | Amber (#FAEEDA bg, #633806 text) |

**Text input:** Single textarea, 13px, 2 rows default, resizable vertically. Min-height 36px.

**Submit button:** 13px, weight 500, pill radius. Colour matches selected tab.

**Validation:**

- Resolve: note must be at least 10 characters.
- Note: note must be at least 10 characters.
- Escalate: escalation reason is required, minimum 10 characters.
- Show inline validation error below textarea if submitted with insufficient input.

#### CM view — flag is resolved/noted/escalated

Replace triage controls with a resolution summary:

- Green/blue/amber background matching the resolution type.
- 12px text showing: "[Icon] [Resolution type]: [note text]"
- No further actions available to CM on this flag.

#### CCO view — flag is escalated (status: `CM_REVIEWED`)

Show only escalated flags prominently. Resolved/noted flags appear in a collapsed summary section (see §5.5).

For each escalated flag:

- CM's escalation reason displayed in an amber callout below the evidence.
- CCO triage controls:
  - "Resolve" — CCO provides compliance resolution note.
  - "Accept risk" — CCO acknowledges risk with documented rationale.
  - "Create action item" — CCO creates a follow-up task (Phase 2).

#### CCO view — flag is resolved by CM (status: `CM_REVIEWED`)

Not shown individually. Collapsed into summary (§5.5).

#### Advisor view — any flag state (status: `DRAFT_READY`)

Flags visible but triage controls hidden. Entire triage section replaced with a muted label: "Pending compliance review." The advisor can see what was flagged but cannot act on flags.

#### Advisor view — any flag state (status: `ADVISOR_CERTIFIED` or later)

Same as above. Flags visible, no triage controls.

### 5.4 Flag ordering

Flags are ordered within the workspace:

1. Open flags first (not yet triaged by CM).
2. Escalated flags second (awaiting CCO).
3. Noted flags third.
4. Resolved flags last.

Within each group, sort by severity (critical first), then by timestamp (earliest first).

### 5.5 Collapsed flag summary (CCO view)

When the CCO is reviewing a meeting, resolved/noted flags from the CM are collapsed into a single summary row:

```
┌─────────────────────────────────────────────────────────┐
│ ▸ Compliance manager resolved (2 flags)                 │
│   1 resolved · 1 noted                                  │
└─────────────────────────────────────────────────────────┘
```

Clicking expands to show individual resolved/noted flag cards (read-only, with CM's resolution notes visible). The expand/collapse state does not affect the CCO's ability to sign off.

### 5.6 Action bar

Pinned at the bottom of the flag workspace. Content varies by role.

**CM view (status: `ADVISOR_CERTIFIED`):**

```
┌─────────────────────────────────────────────────────────┐
│ 2 flags remaining                [Complete compliance   │
│                                        review]          │
└─────────────────────────────────────────────────────────┘
```

- Left: remaining flag count, 13px, secondary colour.
- Right: "Complete compliance review" button.
  - Disabled (opacity 0.45, pointer-events none) until all flags are triaged.
  - Enabled: blue background (#185FA5), white text, weight 500.
  - On click: calls `POST /api/meetings/:id/cm-review`.

**CCO view (status: `CM_REVIEWED`, with escalations):**

```
┌─────────────────────────────────────────────────────────┐
│ 1 escalated flag remaining       [Sign off compliance   │
│                                        review]          │
└─────────────────────────────────────────────────────────┘
```

- Same pattern. Disabled until all escalated flags resolved by CCO.
- On click: calls `POST /api/meetings/:id/cco-signoff`.

**CCO view (status: `CCO_SIGNED_OFF`):**

```
┌─────────────────────────────────────────────────────────┐
│ All reviews complete              [Finalize meeting]    │
└─────────────────────────────────────────────────────────┘
```

- "Finalize meeting" button. On click: calls `POST /api/meetings/:id/finalize`.

**Advisor view (status: `DRAFT_READY`):**

```
┌─────────────────────────────────────────────────────────┐
│ Review the transcript above,      [Certify meeting      │
│ then certify accuracy                  accuracy]        │
└─────────────────────────────────────────────────────────┘
```

- Attestation statement displayed above the button: "I confirm that this meeting record accurately reflects the discussion that took place. Any corrections have been made above."
- On click: calls `POST /api/meetings/:id/certify`.

---

## 6. Zone 4 — Supporting Content

### 6.1 Transcript & extracted fields

**Before advisor certification (status: `DRAFT_READY`, advisor view):**

- Transcript is fully expanded and editable.
- Extracted fields (topics, recommendations) displayed alongside in a 2-column layout.
- This is the advisor's primary workspace.

**After advisor certification (all roles):**

- Collapsed into a single compact card:

```
┌─────────────────────────────────────────────────────────┐
│ 🔒 Transcript locked after advisor certification ·     │
│    6,842 words · 47 min 23 sec                          │
│    5 topics · 3 recommendations · View full transcript ▾│
└─────────────────────────────────────────────────────────┘
```

- Lock icon + "locked" label reinforces that the transcript cannot be changed.
- "View full transcript" toggle expands the full transcript + extracted fields.
- Default state: collapsed. The CM/CCO rarely need to read the full transcript during flag triage.

### 6.2 Version history

- Displayed below supporting content.
- Shows audit trail entries: advisor certification, CM review completion, CCO sign-off, any reverts.
- Each entry: version number, actor name, timestamp, action label, reason (if revert).
- Always visible, not collapsible.

### 6.3 CCO revert workflow

**Only visible to CCO role, only when status is `CM_REVIEWED` or later.**

Displayed below the flag workspace, above supporting content.

```
┌─────────────────────────────────────────────────────────┐
│ Revert workflow                                         │
│                                                         │
│ [Revert to ▾]  [Reason for revert (required)      ]    │
│                                                         │
│ [Revert workflow]                                       │
└─────────────────────────────────────────────────────────┘
```

- Dropdown: "Back to CM reviewed" or "Back to advisor certified".
- Reason textarea: required, minimum 10 characters.
- Button: secondary style (not primary blue). This is a destructive-adjacent action.
- On click: calls `POST /api/meetings/:id/revert-workflow`.

---

## 7. Responsive States & Transitions

### 7.1 Flag triage interaction flow

When the CM submits a triage action on a flag:

1. Button shows a loading spinner (150ms debounce).
2. On success: triage controls collapse, resolution summary appears with a subtle fade-in (200ms).
3. Progress bar updates (fill width + count text).
4. If all flags triaged: "Complete compliance review" button becomes enabled with a subtle pulse animation (one cycle, 600ms).
5. Flag reorders to its correct position per §5.4 sort order (smooth 200ms slide).

### 7.2 Status transition

When the CM clicks "Complete compliance review" or the CCO clicks "Sign off":

1. Button shows loading state.
2. On success: stepper advances (active step moves right with 300ms transition).
3. Certification/review banner updates.
4. Page content re-renders for the new status.
5. Success toast: "[Meeting] — compliance review completed" (auto-dismiss 4 seconds).

### 7.3 Error handling

- Network error: toast with "Failed to save — please try again" + retry button.
- Validation error (e.g. precondition failed because another user already triaged): toast with explanation + page refresh to latest state.
- Stale state conflict: if the meeting status has changed since page load, show a banner: "This meeting has been updated by another user. Refresh to see the latest state." with refresh button.

---

## 8. Accessibility

- All interactive elements must be keyboard-navigable (tab order follows visual order).
- Segmented triage control tabs are an ARIA radio group (`role="radiogroup"`, each tab `role="radio"`).
- Progress bar has `role="progressbar"`, `aria-valuenow`, `aria-valuemin="0"`, `aria-valuemax="[total flags]"`, `aria-label="Flag triage progress"`.
- Status badges use `aria-label` with the full status text (e.g. `aria-label="Status: advisor certified"`).
- Resolution summaries announced to screen readers on submission via `aria-live="polite"` region.
- Colour is never the sole indicator of state — all status badges include text labels, all severity levels include text, resolution summaries include type text alongside colour.

---

## 9. Implementation Components

### 9.1 New components

| Component               | Location                                           | Description                                                                                               |
| ----------------------- | -------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `WorkflowStepper`       | `src/components/meetings/workflow-stepper.tsx`     | 4-step horizontal progress indicator. Props: `currentStatus`, `advisorName`, `certifiedAt`.               |
| `FlagTriageCard`        | `src/components/flags/flag-triage-card.tsx`        | Single flag card with integrated triage controls. Props: `flag`, `userRole`, `meetingStatus`, `onTriage`. |
| `TriageControls`        | `src/components/flags/triage-controls.tsx`         | Segmented tab control + textarea + submit button. Props: `onSubmit`, `flagId`.                            |
| `FlagResolutionSummary` | `src/components/flags/flag-resolution-summary.tsx` | Read-only resolution display (green/blue/amber). Props: `resolution`, `note`, `resolvedBy`.               |
| `CollapsedFlagGroup`    | `src/components/flags/collapsed-flag-group.tsx`    | CCO view: expandable summary of CM-resolved flags. Props: `flags`, `expanded`.                            |
| `ReviewActionBar`       | `src/components/meetings/review-action-bar.tsx`    | Bottom action bar. Props: `userRole`, `meetingStatus`, `remainingFlags`, `onAction`.                      |
| `TranscriptCollapsed`   | `src/components/meetings/transcript-collapsed.tsx` | Compact transcript summary with expand toggle. Props: `wordCount`, `duration`, `topicCount`, `recCount`.  |

### 9.2 Modified components

| Component           | Location                                     | Change                                                          |
| ------------------- | -------------------------------------------- | --------------------------------------------------------------- |
| `MeetingDetailPage` | `src/app/(workspace)/meetings/[id]/page.tsx` | Restructure layout into 4 zones; add role-gating logic.         |
| `FlagsPanel`        | `src/components/flags/flags-panel.tsx`       | Replace current dual-section layout with `FlagTriageCard` list. |
| `StatusBadge`       | `src/components/ui/status-badge.tsx`         | Add new status values and colour mappings.                      |

### 9.3 Hooks

| Hook                 | Purpose                                                                                                                          |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `useWorkflowRole`    | Returns current user's role for the active workspace. Reads from session/workspace membership.                                   |
| `useFlagTriage`      | Manages optimistic triage state: selected tab, input value, submission, progress tracking.                                       |
| `useMeetingWorkflow` | Manages meeting status transitions: certify, CM complete, CCO sign-off, finalize. Handles optimistic updates and error rollback. |

---

## 10. Implementation Stories

**Legend:** P0 = demo-blocking (22 May); P1 = soon after; P2 = Phase 3+.

### Epic U-REDESIGN — Meeting detail page

| ID                    | Story                                         | Priority | Acceptance criteria                                                                                                                      |
| --------------------- | --------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| **U-STEPPER**         | Build `WorkflowStepper` component             | P0       | Renders 4 steps; correct done/active/pending states per meeting status; certification banner shows advisor name + timestamp              |
| **U-FLAG-CARD**       | Build `FlagTriageCard` with integrated triage | P0       | Flag evidence, quote, metadata, and triage controls in single card; segmented tab switches action type and placeholder; submit calls API |
| **U-RESOLUTION**      | Build `FlagResolutionSummary` inline display  | P0       | Resolved flags show green/blue/amber summary; triage controls hidden; resolution note visible                                            |
| **U-PROGRESS**        | Build progress bar for CM view                | P0       | Dynamically updates count and fill as flags are triaged; accurate percentage                                                             |
| **U-ACTION-BAR**      | Build `ReviewActionBar` per role              | P0       | Disabled until preconditions met; correct label and API call per role; loading state on submit                                           |
| **U-ROLE-GATE**       | Implement role-gated rendering                | P0       | Advisor sees flags read-only; CM sees triage controls; CCO sees escalated flags + revert; no role sees another role's controls           |
| **U-TRANSCRIPT**      | Build collapsed transcript view               | P0       | Default collapsed post-certification; expand toggle works; lock icon + word count + duration visible                                     |
| **U-COLLAPSED-GROUP** | Build collapsed flag group for CCO            | P1       | CM-resolved flags in expandable summary; escalated flags shown fully; expand/collapse works                                              |
| **U-TRANSITIONS**     | Animate triage + status transitions           | P1       | Resolution fade-in; progress bar update; stepper advance; toast notifications                                                            |
| **U-STALE-STATE**     | Handle concurrent editing conflicts           | P1       | Banner shown when meeting updated by another user; refresh button reloads                                                                |
| **U-A11Y**            | Accessibility audit and fixes                 | P1       | Keyboard nav; ARIA roles on stepper, tabs, progress; screen reader announcements for triage actions                                      |

### Dependencies

1. Workflow PRD stories **M-STATUS**, **M-ROLES** must be complete before **U-ROLE-GATE**.
2. **A-CERTIFY**, **A-CM-COMPLETE**, **A-CCO-SIGNOFF** APIs must exist before **U-ACTION-BAR** can call them (can stub during development).
3. **U-FLAG-CARD** depends on **M-FLAG-MAP** (flag triage model alignment).

---

## 11. Design Tokens Reference

Quick reference for implementation. All values from ComplyVault design system.

### Colours used in this page

| Token     | Usage                                             | Value   |
| --------- | ------------------------------------------------- | ------- |
| Green 50  | Resolved background, certification banner         | #E1F5EE |
| Green 600 | Done step border                                  | #0F6E56 |
| Green 800 | Resolved text, certification text                 | #085041 |
| Blue 50   | Active step, note background, CM triage highlight | #E6F1FB |
| Blue 200  | Selected tab border                               | #85B7EB |
| Blue 600  | Active step border, progress bar fill             | #185FA5 |
| Blue 800  | Active step text, note text                       | #0C447C |
| Amber 50  | Open/escalated badge, escalate highlight          | #FAEEDA |
| Amber 100 | Escalate tab border                               | #FAC775 |
| Amber 800 | Open/escalated text                               | #633806 |
| Red 50    | Critical badge background                         | #FCEBEB |
| Red 800   | Critical badge text                               | #791F1F |
| Gray 50   | Finalized badge background, pending step          | #F1EFE8 |
| Gray 600  | Finalized badge text                              | #444441 |

### Spacing

| Element                  | Value        |
| ------------------------ | ------------ |
| Card padding             | 1rem 1.25rem |
| Gap between cards        | 12px         |
| Section label margin-top | 20px         |
| Stepper step padding     | 10px 0 8px   |
| Badge padding            | 2px 8px      |
| Triage input padding     | 8px 10px     |
| Action bar padding       | 12px 16px    |

### Typography

| Element             | Size | Weight                  |
| ------------------- | ---- | ----------------------- |
| Client name         | 18px | 500                     |
| Section labels      | 13px | 500                     |
| Flag recommendation | 14px | 500                     |
| Evidence quote      | 13px | 400, italic             |
| Evidence metadata   | 12px | 400                     |
| Badge text          | 11px | 500                     |
| Triage tab text     | 13px | 400 (500 when selected) |
| Action bar button   | 14px | 500                     |
| Metadata labels     | 13px | 400                     |
| Metadata values     | 13px | 500                     |
| Progress text       | 13px | 400                     |

---

## 12. Implementation status (as-built)

**Last updated:** 18 May 2026

This section records what is **implemented in the ComplyVault repo** versus §§9–10 above. The earlier sections remain the **design intent**; use this section for **engineering truth**.

### 12.1 Epic U-REDESIGN — story checklist

| ID | Status | Implementation notes |
| --- | --- | --- |
| **U-STEPPER** | Done | `src/components/meetings/workflow-stepper.tsx`; step states + certification banner; `aria-current="step"` on active step; border transitions. |
| **U-FLAG-CARD** | Done | `src/components/flags/flag-triage-card.tsx`; CM triage via `TriageControls`; remediation drawer still from `src/app/(app)/meetings/[id]/flags-panel.tsx` for non–quick-triage paths. |
| **U-RESOLUTION** | Done | `src/components/flags/flag-resolution-summary.tsx`; fade-in utility class from `src/styles/globals.css`. |
| **U-PROGRESS** | Done | CM triage bar in `src/components/meetings/meeting-workflow-progress.tsx`; `aria-valuetext` + animated fill. |
| **U-ACTION-BAR** | Done | `src/components/meetings/review-action-bar.tsx`; finalize via `src/app/(app)/meetings/[id]/finalize-button.tsx` when embedded. |
| **U-ROLE-GATE** | Done | Session role + `~/lib/meeting-workflow` helpers; CCO revert in `src/components/meetings/cco-revert-panel.tsx`. |
| **U-TRANSCRIPT** | Done | Collapsed/expand pattern in `src/components/meetings/meeting-transcript-section.tsx` (not named `transcript-collapsed.tsx`). |
| **U-COLLAPSED-GROUP** | Done | `src/components/flags/collapsed-flag-group.tsx`. |
| **U-TRANSITIONS** | Done (partial) | Toasts (e.g. 4s success), debounced triage spinner (150ms), resolution fade-in, step/fill CSS transitions, pulse when all flags triaged. **Not** full FLIP/list reorder “slide” (§7.1). |
| **U-STALE-STATE** | Done | `src/components/meetings/meeting-stale-banner.tsx` + `src/hooks/use-meeting-stale-detection.ts`; fingerprint `syncToken` from `src/lib/meeting-sync-token.ts` and `GET /api/meetings/[id]/status`. |
| **U-A11Y** | Done (targeted) | Radiogroup + arrow keys on triage tabs, progressbar semantics, focus rings, transcript expand `aria-controls` / region, live region on resolution summary. **Not** a formal WCAG audit report. |

### 12.2 Canonical file map (meeting detail UX)

| Concern | Path |
|---------|------|
| Meeting detail page (4 zones) | `src/app/(app)/meetings/[id]/page.tsx` |
| Flag workspace shell + remediation drawer | `src/app/(app)/meetings/[id]/meeting-flags-workspace.tsx`, `src/app/(app)/meetings/[id]/flags-panel.tsx` |
| Flag ordering / CCO grouping helpers | `src/lib/flag-workspace-sort.ts` |
| Header / workflow / stale / revert | `src/components/meetings/meeting-header-card.tsx`, `meeting-workflow-progress.tsx`, `meeting-stale-banner.tsx`, `cco-revert-panel.tsx` |

### 12.3 Deviations from §9 (components & hooks)

- **Transcript:** Implemented as `MeetingTranscriptSection`, not `transcript-collapsed.tsx`.
- **FlagsPanel:** Remains under `src/app/(app)/meetings/[id]/flags-panel.tsx`; list UI is composed by `MeetingFlagsWorkspace`, not under `src/components/flags/flags-panel.tsx`.
- **StatusBadge:** No standalone `src/components/ui/status-badge.tsx`; meeting status pill lives in `meeting-header-card.tsx`.
- **MeetingDetailPage:** App Router group is `(app)`, not `(workspace)`.
- **Hooks (§9.3):** `useWorkflowRole`, `useFlagTriage`, and `useMeetingWorkflow` were **not** added as separate modules; behavior lives in the components above, `~/lib/meeting-workflow`, and the stale-detection hook.

### 12.4 Product gaps vs §5–6 (by design or backlog)

- **§5.3 CCO — “Create action item”:** Marked **Phase 2** in §5.3; **not implemented** in UI.
- **§5.3 CCO — inline “Resolve” / “Accept risk”** vs remediation drawer: behavior is covered by **existing remediation / verification** flows (drawer); **IA is not** identical to the wire copy (single “Resolve / verify flag” entry).
- **§5.6 Advisor action bar:** Copy layout may differ slightly from the two-line mock (same actions and API).
- **§11 tokens:** Spacing/typography are **close** to the table; not audited pixel-for-pixel on every control.

### 12.5 Related APIs (sign-off stack)

Certify, CM review, CCO sign-off, finalize, revert, and CM flag triage are implemented under `src/app/api/meetings/...` and `src/app/api/flags/...`; see `docs/three-layer-signoff.md` for the workflow PRD.
