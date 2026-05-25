# PRD: Workspace Invitation & Onboarding Workflow

**Product:** ComplyVault  
**Author:** Hamza Naveed  
**Status:** Ready for implementation  
**Priority:** P1  
**Date:** May 2026

---

## Problem

The current invitation accept flow auto-accepts on page load with no confirmation step, no inviter identity, no role-specific context, and no post-accept onboarding. Invited users land on a generic dashboard without understanding what they've joined or what to do next. The invitation email sends identical copy regardless of role. There is no pending invitations management UI — workspace owners cannot view, resend, or revoke invitations after sending. These gaps erode trust for compliance buyers who need confidence at every step before committing their firm's data to a new system.

---

## Goals

1. Invited users understand exactly what they're joining, who invited them, and what their role means before they accept
2. The accept flow is a single explicit confirmation step — no auto-accept
3. Invitation emails contain role-specific copy and inviter identity
4. Workspace owners can view, resend, and revoke pending invitations
5. Post-accept, users see role-specific first-run guidance
6. All error and edge-case states are designed and implemented
7. The invite page is access-controlled at the layout level, not just API level

---

## Non-Goals

- Password-based authentication on the accept page (Google OAuth only for now)
- Role-specific dashboard customisation (separate initiative)
- Partner/CCO multi-workspace dashboard (separate initiative)
- Billing plan upgrade flows from the seat limit error state

---

## User Stories

**US-1 — Invitee accepts invitation (happy path)**
As an invited user, I click the invitation link in my email, see who invited me and what workspace I'm joining, confirm with one click, and land on a dashboard with guidance for my role.

**US-2 — Invitee accepts invitation (not signed in)**
As an invited user who is not signed in, I see the invitation details and a "Continue with Google" button. After signing in with the correct email, I return to the confirmation screen and accept.

**US-3 — Invitee uses wrong Google account**
As an invited user who signs in with the wrong Google account, I see a clear error explaining the mismatch and a "Sign in with a different account" action.

**US-4 — Owner manages pending invitations**
As a workspace owner, I can view all pending invitations in workspace settings, see when each was sent and whether it's expired, and resend or revoke any invitation.

**US-5 — Owner hits seat limit**
As a workspace owner who has reached the seat limit, I see a message explaining how many seats are used (including pending invitations) and how to free seats by revoking unused invitations.

**US-6 — Invitee clicks expired link**
As an invited user with an expired link, I see a clear message telling me the invitation has expired and to ask the workspace owner to send a new one.

---

## Scope of Work

### Workstream 1: Accept Invitation Page Rebuild

**Files to modify:**

- `src/app/invitations/accept/accept-client.tsx` — full rewrite
- `src/app/invitations/accept/page.tsx` — no layout changes needed (already standalone)
- `src/app/api/invitations/verify/route.ts` — extend response payload
- `src/app/api/invitations/accept/route.ts` — no changes needed

**Files to create:**

- `src/app/invitations/accept/components/confirm-screen.tsx`
- `src/app/invitations/accept/components/sign-in-screen.tsx`
- `src/app/invitations/accept/components/success-screen.tsx`
- `src/app/invitations/accept/components/error-screen.tsx`
- `src/app/invitations/accept/components/loading-screen.tsx`
- `src/lib/role-config.ts`

#### Task 1.1 — Extend verify API response

**File:** `src/app/api/invitations/verify/route.ts`

The verify endpoint currently returns workspace name, role, and invited email. Extend the response to include inviter identity and firm CRD.

Response shape after change:

```typescript
{
  valid: true,
  workspaceName: string,
  role: "OWNER_CCO" | "MEMBER" | "ADVISOR",
  invitedEmail: string,
  inviterName: string,       // NEW — from User table via Invitation.invitedBy
  inviterRole: string,       // NEW — display label from UserWorkspace role
  firmCRD: string | null,    // NEW — from Workspace table if stored
}
```

Implementation: join Invitation → User (invitedBy) and Invitation → Workspace. The `invitedBy` field on the Invitation model may not exist yet — if not, add it to the schema (see Task 1.2).

**Acceptance criteria:**

- Verify response includes `inviterName`, `inviterRole`, `firmCRD`
- Existing error responses (expired, invalid, already accepted) unchanged
- No breaking changes to accept API

#### Task 1.2 — Schema: add invitedBy to Invitation model

**File:** `prisma/schema.prisma`

Add `invitedById` foreign key to the `Invitation` model pointing to the `User` who created the invitation. Backfill is not required — this field is nullable for existing rows.

```prisma
model Invitation {
  // ... existing fields
  invitedBy   User?   @relation("InvitationsSent", fields: [invitedById], references: [id])
  invitedById String?
}
```

**Also update:** `src/app/api/workspaces/[workspaceId]/invitations/route.ts` — set `invitedById` from session user when creating an invitation.

**Acceptance criteria:**

- Migration runs cleanly
- New invitations populate `invitedById`
- Existing invitations have `invitedById: null` (no backfill required)
- Verify API handles null `invitedById` gracefully (show workspace name only)

#### Task 1.3 — Role config utility

**File:** `src/lib/role-config.ts`

Centralise role display labels, summaries, and first-step copy. This is used by the accept page, invitation email, and post-accept onboarding.

```typescript
export const ROLE_CONFIG = {
  OWNER_CCO: {
    label: 'Owner / CCO',
    summary:
      'Finalize records, manage workspace settings, and invite team members.',
    steps: [
      'Configure workspace retention and compliance settings',
      'Invite your team and assign roles',
      'Upload and review your first meeting recording',
    ],
  },
  MEMBER: {
    label: 'Compliance Manager',
    summary: 'Triage flagged items and support the compliance review workflow.',
    steps: [
      'Review flagged items in your review queue',
      'Collaborate with your CCO on open compliance items',
      'Explore the meeting records dashboard',
    ],
  },
  ADVISOR: {
    label: 'Advisor',
    summary: 'Review and certify the accuracy of your meeting transcripts.',
    steps: [
      'Review meeting transcripts assigned to you',
      'Certify accuracy and completeness of records',
      'Check your notification preferences',
    ],
  },
} as const;

export type WorkspaceRole = keyof typeof ROLE_CONFIG;
```

**Also refactor:** `src/lib/workspace-display.ts` — import labels from `role-config.ts` instead of defining them inline. This eliminates the duplication that causes the sidebar footer label inconsistency.

**Acceptance criteria:**

- Single source of truth for role labels across the app
- Sidebar footer uses same labels as invite page and accept page
- Advisor no longer shows "Member" in sidebar footer

#### Task 1.4 — Accept page rewrite

**File:** `src/app/invitations/accept/accept-client.tsx` — full rewrite

Replace the current auto-accept implementation with a screen-based state machine. The page cycles through five states: loading → sign-in OR confirm → success → redirect.

**State machine:**

```
LOADING
  ├─ verify fails → ERROR (expired | invalid | accepted | error)
  ├─ verify succeeds + not signed in → SIGN_IN
  └─ verify succeeds + signed in
       ├─ email mismatch → ERROR (mismatch)
       └─ email matches → CONFIRM

SIGN_IN
  └─ user signs in via Google → page reloads → LOADING → CONFIRM

CONFIRM
  └─ user clicks "Join workspace" → ACCEPTING → SUCCESS → redirect /dashboard

ERROR (terminal — no transitions out except user actions like "Switch account")
```

**Critical change: remove auto-accept.** The current code calls the accept API on page load when emails match. Remove this entirely. The user must click "Join workspace" to accept.

**Screen specifications:**

**Loading screen**

- Centered spinner + "Verifying invitation…"
- No other content
- Shown while GET /api/invitations/verify is in flight

**Sign-in screen** (user not authenticated)

- Workspace initials badge + workspace name as heading
- "{inviterName} invited you as {role label}" as subheading
- Details card: workspace, role, invited by, sent-to email, CRD (if present)
- Footnote: "Sign in with {invitedEmail} to continue"
- "Continue with Google" button — calls `signIn("google", { callbackUrl: currentUrl })`

**Confirm screen** (user authenticated, email matches)

- Left-aligned header: workspace initials + workspace name + "Invited by {inviterName} · CRD {firmCRD}"
- Role card with "Your role" label + role tag, role summary, and numbered "Getting started" steps from role-config
- Signed-in indicator: green tint bar with "{email}"
- "Join workspace" primary button — calls POST /api/invitations/accept
- "Wrong account? Switch" footnote — calls signOut with redirect back to accept URL

**Success screen**

- Checkmark in green-tinted square + "You've joined {workspaceName}"
- "Signed in as {role label}."
- "Redirecting to dashboard…"
- Auto-redirect to `/dashboard` after 2 seconds via `window.location.href` (full page navigation, not router.push, so session callback picks up the new workspace cookie)

**Error screens**

| Type     | Title                | Body                                                                                 | Action                                              |
| -------- | -------------------- | ------------------------------------------------------------------------------------ | --------------------------------------------------- |
| expired  | Invitation expired   | This invitation is no longer valid. Ask the workspace owner to send a new one.       | "Contact support" link                              |
| invalid  | Invalid invitation   | This link is not valid. It may have been copied incorrectly or already used.         | "Contact support" link                              |
| accepted | Already accepted     | This invitation has already been used. Sign in to access your workspace.             | "Sign in" primary button → /auth/signin             |
| mismatch | Wrong account        | You're signed in with {currentEmail} but this invitation was sent to {invitedEmail}. | "Sign in with a different account" secondary button |
| error    | Something went wrong | We couldn't verify this invitation. Please try again.                                | "Contact support" link                              |

**Design tokens (matching the approved component):**

```typescript
const COLORS = {
  brand: '#117A4B',
  brandDark: '#0c5f3a',
  brandSubtle: '#e9f3ee',
  text: '#111827',
  textSecondary: '#4b5563',
  textTertiary: '#9ca3af',
  surface: '#ffffff',
  bg: '#f9fafb',
  border: '#e5e7eb',
  borderSubtle: '#f3f4f6',
  red: '#b91c1c',
  redBg: '#fef2f2',
};
```

**Typography:** System stack — `'Söhne', 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif`. No serif, no display fonts. Weight 600 for headings, 500 for emphasis, 400 for body. Tight letter-spacing (-0.02em on headings).

**Layout:** Standalone page (no sidebar, no top bar). Centered card, max-width 420px, 12px border-radius, 1px border, minimal box-shadow. ComplyVault wordmark above card. "SEC-compliant meeting documentation for RIA firms" footnote below.

**No emoji. No decorative icons.** The only visual elements are: workspace initials block, Google logo on OAuth button, a single SVG stroke circle-exclamation for error states, a single SVG stroke checkmark for success state.

**Acceptance criteria:**

- Auto-accept is removed — user must click to join
- All five screens render correctly with real API data
- Email mismatch shows clear error with account-switch action
- Success screen redirects via full page navigation (not router.push)
- Page remains outside `(app)` layout (no sidebar/top bar)
- Accessible: proper heading hierarchy, button focus states, aria-live on alerts

---

### Workstream 2: Invitation Email — Role-Specific Copy & Inviter Identity

**Files to modify:**

- `src/server/email.ts` → `sendInvitationEmail`

#### Task 2.1 — Add inviter name and role-branched copy to invitation email

The invitation email currently sends identical content regardless of role and does not identify who sent the invitation.

**Changes:**

1. Add "Invited by {inviterName}, {inviterRole} at {workspaceName}" below the headline
2. Replace the static "next steps" checklist with the role-specific steps from `ROLE_CONFIG`
3. Update the role callout box to use the role summary from `ROLE_CONFIG`
4. Change CTA button colour from `#2563eb` (blue) to `#117A4B` (brand green) for consistency with the app

**Email structure after change:**

```
Subject: {inviterName} invited you to join {workspaceName} on ComplyVault

Headline: You've been invited to join {workspaceName}
Subline: {inviterName} ({inviterRole}) has invited you to join as {roleLabel}.

[Role callout box]
  Your Role: {roleLabel}
  {roleSummary}

[CTA button: "Accept Invitation" — brand green #117A4B]
[Fallback URL]

Getting started:
  1. {step 1 from ROLE_CONFIG}
  2. {step 2 from ROLE_CONFIG}
  3. {step 3 from ROLE_CONFIG}

This invitation will expire in 7 days.
```

**Acceptance criteria:**

- Email subject includes inviter name
- Email body shows inviter name and role
- "Getting started" steps match the role being invited
- CTA button uses brand green
- Existing email rendering in major clients (Gmail, Outlook) is not broken (test manually)

---

### Workstream 3: Pending Invitations Management UI

**Files to create:**

- `src/app/(app)/settings/components/pending-invitations.tsx`
- `src/app/api/workspaces/[workspaceId]/invitations/pending/route.ts`
- `src/app/api/workspaces/[workspaceId]/invitations/[invitationId]/revoke/route.ts`

**Files to modify:**

- `src/app/(app)/settings/page.tsx` — add pending invitations section
- `prisma/schema.prisma` — add `REVOKED` status to invitation (if not already present)

#### Task 3.1 — Pending invitations API

**File:** `src/app/api/workspaces/[workspaceId]/invitations/pending/route.ts`

GET endpoint returning all non-accepted invitations for the workspace. Auth: `OWNER_CCO` only.

```typescript
// Response
{
  invitations: Array<{
    id: string;
    email: string;
    role: 'OWNER_CCO' | 'MEMBER' | 'ADVISOR';
    roleLabel: string;
    status: 'PENDING' | 'EXPIRED' | 'REVOKED';
    createdAt: string;
    expiresAt: string;
    inviterName: string | null;
  }>;
}
```

Derive status at query time: if `expiresAt < now` and not accepted, status is `EXPIRED`. This avoids needing a cron job to update statuses.

#### Task 3.2 — Revoke invitation API

**File:** `src/app/api/workspaces/[workspaceId]/invitations/[invitationId]/revoke/route.ts`

POST endpoint that marks an invitation as revoked. Auth: `OWNER_CCO` only.

- Set invitation status to `REVOKED` (or soft-delete — set `revokedAt` timestamp)
- Revoked invitations no longer count toward seat limits
- Revoking allows re-inviting the same email (resolves the expired-invitation-blocks-reinvite bug)
- Log `INVITE_REVOKED` audit event

**Schema change if needed:** Add `revokedAt DateTime?` to Invitation model. An invitation is revokable if `acceptedAt IS NULL AND revokedAt IS NULL`.

**Acceptance criteria:**

- Revoked invitations return "Invalid invitation" on the accept page
- Seat count decreases when an invitation is revoked
- Same email can be re-invited after revocation
- Audit log records revocation with actor, timestamp, IP

#### Task 3.3 — Pending invitations UI in settings

**File:** `src/app/(app)/settings/components/pending-invitations.tsx`

Add a "Pending Invitations" section to the workspace settings page, between the team members list and the actions section.

**Table columns:** Email, Role, Sent, Status, Actions

**Status display:**

- Pending (green text) — invitation is active and not expired
- Expired (muted text) — past expiry date, not accepted
- Revoked (muted text, strikethrough email) — owner revoked

**Actions per row:**

- Pending: "Resend" button (calls existing resend API) + "Revoke" button
- Expired: "Re-invite" button (creates new invitation) + "Remove" button (revoke to clear)
- Revoked: "Re-invite" button

**Empty state:** "No pending invitations. Invite team members to get started." with link to invite page.

**Acceptance criteria:**

- Only visible to `OWNER_CCO`
- Expired invitations clearly distinguishable from active ones
- Resend reuses existing token (existing behaviour)
- Revoke requires confirmation ("Revoke invitation to {email}?")
- Re-invite after expiry/revocation creates a fresh invitation
- Seat count shown: "{n} of {max} seats used (including {p} pending)"

---

### Workstream 4: Access Control & Cleanup

#### Task 4.1 — Hide invite page from non-owners at layout level

**File:** `src/app/(app)/workspaces/[workspaceId]/invite/page.tsx`

Currently the invite form renders for all roles and the API rejects on submit. Add a server-side role check at the page level.

```typescript
// At top of page component
const session = await getServerSession(authOptions);
const membership = await getMembership(session.user.id, params.workspaceId);

if (membership?.role !== 'OWNER_CCO') {
  redirect('/dashboard');
}
```

**Acceptance criteria:**

- Non-owner navigating to `/workspaces/{id}/invite` is redirected to dashboard
- No flash of the invite form before redirect (server-side check, not client-side)

#### Task 4.2 — Fix sidebar footer role label

**File:** `src/components/app-sidebar.tsx`

The sidebar footer currently maps all non-`OWNER_CCO` roles to "Member". Update to use `ROLE_CONFIG` from `src/lib/role-config.ts`.

```typescript
import { ROLE_CONFIG } from '@/lib/role-config';
// Replace hardcoded label logic with:
const roleLabel = ROLE_CONFIG[membership.role]?.label ?? 'Member';
```

**Acceptance criteria:**

- Advisor users see "Advisor" in sidebar footer
- Compliance Manager users see "Compliance Manager" in sidebar footer
- Owner/CCO users see "Owner / CCO" in sidebar footer

---

### Workstream 5: Post-Accept Role Onboarding (Lightweight)

#### Task 5.1 — Role-specific welcome banner on dashboard

**Files to modify:**

- `src/app/(app)/dashboard/page.tsx`

**Files to create:**

- `src/app/(app)/dashboard/components/welcome-banner.tsx`

After a user accepts an invitation, show a dismissable welcome banner at the top of the dashboard for their first session. The banner uses role-config steps.

**Display logic:** Show the banner when the user's `UserWorkspace.onboardingDismissedAt` is null. Add `onboardingDismissedAt DateTime?` to the `UserWorkspace` model.

**Banner content:**

```
Welcome to {workspaceName}

As {roleLabel}, here's how to get started:

1. {step 1}
2. {step 2}
3. {step 3}

[Dismiss]
```

**Design:** Full-width card at top of dashboard content area. Brand green left border. No background colour — white card with border. Dismiss button is text-only, right-aligned.

**Dismiss API:** PATCH `/api/workspaces/{id}/onboarding/dismiss` — sets `onboardingDismissedAt` on the user's `UserWorkspace` row.

**Acceptance criteria:**

- Banner shows on first dashboard load after accepting an invitation
- Banner content matches the user's role
- Dismissing persists — banner does not reappear on refresh
- Banner does not show for workspace creators (they have the `/welcome` onboarding flow)
- Banner does not show if user has already dismissed it

---

## Implementation Order

This is the recommended sequence for Cursor. Each task is independently shippable.

| Order | Task                                  | Depends on | Effort |
| ----- | ------------------------------------- | ---------- | ------ |
| 1     | 1.3 — Role config utility             | —          | Small  |
| 2     | 4.2 — Sidebar footer role label fix   | 1.3        | Small  |
| 3     | 1.2 — Schema: invitedBy on Invitation | —          | Small  |
| 4     | 1.1 — Extend verify API               | 1.2, 1.3   | Medium |
| 5     | 1.4 — Accept page rewrite             | 1.1, 1.3   | Large  |
| 6     | 2.1 — Invitation email update         | 1.2, 1.3   | Medium |
| 7     | 3.2 — Revoke API + schema             | —          | Medium |
| 8     | 3.1 — Pending invitations API         | 3.2        | Medium |
| 9     | 3.3 — Pending invitations UI          | 3.1        | Medium |
| 10    | 4.1 — Invite page access control      | —          | Small  |
| 11    | 5.1 — Welcome banner                  | 1.3        | Medium |

**Total estimate:** 5–7 working days for a single developer familiar with the codebase.

---

## Testing Checklist

**Accept flow — happy path:**

- [ ] Click invitation link → loading screen → confirm screen with correct workspace, role, inviter
- [ ] Click "Join workspace" → accepting state → success screen → redirect to dashboard
- [ ] Dashboard shows welcome banner with role-specific steps
- [ ] Sidebar shows correct role label
- [ ] `INVITE_ACCEPTED` audit event logged with IP and user agent

**Accept flow — not signed in:**

- [ ] Click invitation link → loading → sign-in screen with invitation details
- [ ] Click "Continue with Google" → Google OAuth → returns to accept page → confirm screen
- [ ] Confirm and accept as above

**Accept flow — email mismatch:**

- [ ] Sign in with wrong Google account → mismatch error screen
- [ ] "Sign in with a different account" → sign out → return to accept page → sign-in screen
- [ ] Sign in with correct account → confirm → accept

**Accept flow — error states:**

- [ ] Expired token → "Invitation expired" screen with "Contact support" link
- [ ] Invalid/missing token → "Invalid invitation" screen
- [ ] Already accepted token → "Already accepted" screen with "Sign in" button
- [ ] Already a member → sets active workspace, redirects to dashboard (existing behaviour)

**Invitation email:**

- [ ] Email subject includes inviter name
- [ ] Email body shows inviter identity and role
- [ ] "Getting started" steps match invited role
- [ ] CTA button is brand green
- [ ] Renders correctly in Gmail and Outlook

**Pending invitations:**

- [ ] Owner sees pending invitations in settings
- [ ] Resend sends email and shows success
- [ ] Revoke prompts confirmation, then removes invitation
- [ ] Revoked invitation returns "Invalid" on accept page
- [ ] Re-invite after revoke creates new invitation for same email
- [ ] Seat count updates after revoke
- [ ] Non-owner does not see pending invitations section

**Access control:**

- [ ] Non-owner navigating to invite page is redirected to dashboard (no flash)
- [ ] Non-owner cannot see invite link in sidebar dropdown

**Welcome banner:**

- [ ] Shows on first dashboard load after accept
- [ ] Content matches role
- [ ] Dismiss persists across page refreshes
- [ ] Does not show for workspace creators
- [ ] Does not show after dismissal

---

## Reference Component

The approved accept page component is available at:

```
accept-invitation-page.jsx
```

This is a self-contained React component with all screen states, design tokens, and role-specific copy. Use it as the visual and behavioural reference when implementing Task 1.4. The mock data and `setTimeout` calls should be replaced with real API calls. The `DemoControls` component should be removed.

---

## Open Decisions (Resolve Before Implementation)

1. **Firm CRD storage:** Is `firmCRD` stored on the Workspace model today? If not, should it be added as an optional field in workspace settings, or omitted from the accept page until it exists?

2. **invitedBy backfill:** For existing invitations that predate the `invitedBy` field, the accept page will show workspace name only (no inviter name). Is this acceptable, or should we backfill from audit logs?

3. **Revoke vs soft-delete:** Should revoked invitations be permanently deleted or soft-deleted with a `revokedAt` timestamp? Soft-delete preserves the audit trail. Recommendation: soft-delete.

4. **Re-invite after expiry:** Currently the unique constraint on (email, workspaceId) for pending invitations blocks re-inviting after expiry. The revoke mechanism resolves this for revoked invitations. For expired invitations, should the invite API automatically clean up expired rows, or should the owner explicitly "remove" expired invitations first?
