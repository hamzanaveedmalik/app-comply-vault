# Fix: Removed members should not land on "Create Workspace"

## Problem

When a workspace owner removes a team member, that member loses all `UserWorkspace` rows. On their next login (or page refresh), `resolvePostAuthRedirect` in `src/lib/auth-redirect.ts` hits the fallback path: no workspace memberships → redirect to `/workspaces/new`. This shows them "Create Your Free Trial Workspace" — which is wrong. They were a team member, not a firm owner. They should not be prompted to start a trial.

This also creates a risk of orphan workspaces polluting billing if confused users click through.

## Root Cause

The redirect logic has two branches:

1. User has workspace(s) → `/dashboard`
2. User has no workspaces → `/workspaces/new`

It cannot distinguish between "brand new user who has never had a workspace" and "user who was removed from a workspace."

## Solution

### 1. Track removal on the UserWorkspace model

Do NOT hard-delete the `UserWorkspace` row when removing a member. Instead, soft-delete it.

**File: `prisma/schema.prisma`**

Add `removedAt` to the `UserWorkspace` model:

```prisma
model UserWorkspace {
  // ... existing fields
  removedAt   DateTime?
  removedById String?
  removedBy   User?     @relation("RemovedByUser", fields: [removedById], references: [id])
}
```

Run `npx prisma migrate dev --name add-userworkspace-soft-delete`.

**File: `src/app/api/workspaces/[workspaceId]/members/[userId]/route.ts`** (or wherever the DELETE member handler lives)

Change from deleting the row to setting `removedAt`:

```typescript
// BEFORE
await prisma.userWorkspace.delete({
  where: { userId_workspaceId: { userId, workspaceId } },
});

// AFTER
await prisma.userWorkspace.update({
  where: { userId_workspaceId: { userId, workspaceId } },
  data: { removedAt: new Date(), removedById: session.user.id },
});
```

### 2. Update all queries to exclude soft-deleted memberships

Every query that fetches a user's workspaces must filter out removed memberships. Search the codebase for all `UserWorkspace` queries and add `removedAt: null` to the where clause.

Key locations to check:

- `src/lib/auth-redirect.ts` — `resolvePostAuthRedirect`
- `src/server/auth/config.ts` — session callback that loads workspace
- `src/components/layout/workspace-dropdown.tsx` — workspace list
- `src/app/api/workspaces/route.ts` — GET workspaces
- `src/app/api/workspaces/switch/route.ts` — switch validation
- `src/app/api/workspaces/[workspaceId]/team/route.ts` — team list

Example:

```typescript
// BEFORE
const memberships = await prisma.userWorkspace.findMany({
  where: { userId: session.user.id },
});

// AFTER
const memberships = await prisma.userWorkspace.findMany({
  where: { userId: session.user.id, removedAt: null },
});
```

### 3. Add a third redirect branch for removed members

**File: `src/lib/auth-redirect.ts`**

Update `resolvePostAuthRedirect` to detect removed members:

```typescript
export async function resolvePostAuthRedirect(
  userId: string,
  callbackUrl?: string,
): Promise<string> {
  // 1. Safe callbackUrl takes priority
  if (callbackUrl && isSafeRedirect(callbackUrl)) {
    return callbackUrl;
  }

  // 2. Check active memberships
  const activeMemberships = await prisma.userWorkspace.findMany({
    where: { userId, removedAt: null },
  });

  if (activeMemberships.length > 0) {
    return '/dashboard';
  }

  // 3. Check if user was ever a member (soft-deleted rows exist)
  const wasRemoved = await prisma.userWorkspace.findFirst({
    where: { userId, removedAt: { not: null } },
  });

  if (wasRemoved) {
    return '/no-workspace'; // Removed member — don't send to create
  }

  // 4. Check for pending invitations
  const pendingInvite = await prisma.invitation.findFirst({
    where: {
      email: userEmail,
      acceptedAt: null,
      expiresAt: { gt: new Date() },
    },
  });

  if (pendingInvite) {
    return `/invitations/accept?token=${pendingInvite.token}`;
  }

  // 5. Genuinely new user — create workspace
  return '/workspaces/new';
}
```

### 4. Create the "no workspace" page

**File: `src/app/(app)/no-workspace/page.tsx`**

This is a simple informational page. Use the `(app)` layout but it will render with the "no workspace" sidebar state (the existing "Create workspace" button in the sidebar is fine here — it serves as a secondary path).

```tsx
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/server/auth/config';
import { prisma } from '@/server/db';

export default async function NoWorkspacePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/auth/signin');

  // If they now have an active membership (e.g. re-invited), send to dashboard
  const activeMembership = await prisma.userWorkspace.findFirst({
    where: { userId: session.user.id, removedAt: null },
  });
  if (activeMembership) redirect('/dashboard');

  // Get the workspace they were removed from (most recent) for context
  const lastRemoval = await prisma.userWorkspace.findFirst({
    where: { userId: session.user.id, removedAt: { not: null } },
    include: { workspace: { select: { name: true } } },
    orderBy: { removedAt: 'desc' },
  });

  const workspaceName = lastRemoval?.workspace?.name;

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="max-w-md w-full bg-white border border-gray-200 rounded-xl p-8 text-center">
        <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center mx-auto mb-5">
          <svg
            width="20"
            height="20"
            viewBox="0 0 20 20"
            fill="none"
            stroke="#9ca3af"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M10 6v4m0 4h.01M18 10a8 8 0 11-16 0 8 8 0 0116 0z" />
          </svg>
        </div>

        <h1 className="text-lg font-semibold text-gray-900 mb-2">
          No active workspace
        </h1>

        <p className="text-sm text-gray-500 leading-relaxed mb-6">
          {workspaceName
            ? `You're no longer a member of ${workspaceName}. If you believe this is an error, contact the workspace administrator.`
            : "You don't currently belong to any workspace. If you were recently removed, contact the workspace administrator."}
        </p>

        <div className="flex flex-col gap-3">
          <a
            href="/workspaces/new"
            className="w-full px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Create your own workspace
          </a>
        </div>

        <p className="text-xs text-gray-400 mt-4">
          If you've been re-invited, check your email for a new invitation link.
        </p>
      </div>
    </div>
  );
}
```

### 5. Update member removal audit event

Make sure the `MEMBER_REMOVED` audit event includes enough context:

```typescript
await logAuditEvent({
  type: 'MEMBER_REMOVED',
  workspaceId,
  actorId: session.user.id,
  targetUserId: userId,
  metadata: {
    removedUserEmail: removedUser.email,
    removedUserRole: membership.role,
  },
});
```

## Testing

1. **Remove a member from a workspace** → Verify `UserWorkspace.removedAt` is set (row is NOT deleted)
2. **Removed member refreshes the page** → They see `/no-workspace`, NOT `/workspaces/new`
3. **Page shows the workspace name** they were removed from
4. **"Create your own workspace" link works** → Takes them to `/workspaces/new` if they choose to
5. **Re-invite the same user** → They accept invitation → land on dashboard → `/no-workspace` is no longer shown
6. **Workspace dropdown** does not show soft-deleted memberships
7. **Team list** does not show soft-deleted members
8. **Switching workspace** does not allow switching to a workspace user was removed from
9. **Brand new user with no history** → Still goes to `/workspaces/new` (not `/no-workspace`)
