# Access Control Implementation Summary

## Overview

This document summarizes the implementation of domain-based access control for Comply Vault, separating the marketing website (complyvault.co) from the app (app.complyvault.co).

## What Has Been Implemented

### 1. Shared Access Guard (`src/server/auth/guards.ts`)

Created `requireAppAccess()` guard function that enforces:
- ✅ Authenticated session
- ✅ Email verification
- ✅ Workspace membership
- ✅ Entitlements: trial active or paid subscription

Also created `requireAuthAndEmailVerified()` for routes that don't require workspace membership (e.g., workspace creation).

### 2. Middleware Domain Detection (`src/middleware.ts`)

Updated middleware to:
- ✅ Detect hostname from request headers
- ✅ Apply different rules based on domain:
  - **Marketing domain (complyvault.co)**: Public access, no auth required
  - **App domain (app.complyvault.co)**: Protected access with auth checks
- ✅ Public allowlist for app domain: `/auth/*`, `/api/auth/*`, `/api/billing/webhook`, `/api/health`, `/invitations`

### 3. Trial Request Endpoint (`src/app/api/trial/request/route.ts`)

Created public endpoint for marketing domain:
- ✅ Stores leads in database (Lead model)
- ✅ Sends verification email to lead
- ✅ Sends notification to internal team
- ✅ Rate limiting (5 requests/hour per IP)
- ✅ Email validation
- ✅ **Does NOT create authenticated sessions**

### 4. Database Schema Update (`prisma/schema.prisma`)

Added `Lead` model for storing trial requests:
```prisma
model Lead {
  id        String   @id @default(cuid())
  email     String
  name      String?
  company   String?
  source    String?
  ipAddress String?
  createdAt DateTime @default(now())

  @@unique([email])
  @@index([email])
  @@index([createdAt])
}
```

### 5. Updated API Routes

The following routes have been updated to use `requireAppAccess()`:
- ✅ `/api/upload/init`
- ✅ `/api/upload/complete`
- ✅ `/api/meetings/[id]/edit`
- ✅ `/api/meetings/[id]/finalize`
- ✅ `/api/search`

### 6. App Layout Protection (`src/app/(app)/layout.tsx`)

Updated to use `requireAppAccess()` for server-side protection.

## What Remains

### API Routes Still Needing Updates

The following routes still need to be updated to use `requireAppAccess()`:

**Protected Routes (require workspace):**
- `/api/upload/route.ts`
- `/api/upload/transcript/route.ts`
- `/api/meetings/[id]/export/route.ts`
- `/api/meetings/[id]/reprocess/route.ts`
- `/api/meetings/[id]/retry/route.ts`
- `/api/meetings/[id]/status/route.ts`
- `/api/meetings/[id]/ready-for-cco/route.ts`
- `/api/meetings/[id]/versions/route.ts`
- `/api/flags/[id]/route.ts`
- `/api/flags/[id]/remediation/route.ts`
- `/api/audit-logs/route.ts`
- `/api/audit-logs/export/route.ts`
- `/api/notifications/route.ts`
- `/api/notifications/count/route.ts`
- `/api/workspaces/[workspaceId]/settings/route.ts`
- `/api/workspaces/[workspaceId]/invitations/route.ts`
- `/api/workspaces/[workspaceId]/invitations/bulk/route.ts`
- `/api/workspaces/[workspaceId]/members/[userId]/route.ts`
- `/api/billing/checkout/route.ts`
- `/api/billing/status/route.ts`
- `/api/billing/setup/route.ts`

**Special Cases:**
- `/api/workspaces/route.ts` (POST) - Should use `requireAuthAndEmailVerified()` since it creates workspace
- `/api/invitations/accept/route.ts` - May need special handling (public with token)
- `/api/admin/flush-meetings/route.ts` - Admin route, may need special handling

**Already Public (no changes needed):**
- `/api/auth/*` - Auth.js endpoints
- `/api/billing/webhook` - Stripe webhook
- `/api/jobs/process-meeting` - QStash webhook
- `/api/trial/request` - Public marketing endpoint
- `/api/metrics` - Has its own auth

### Database Migration

A migration needs to be created for the `Lead` model:
```bash
npx prisma migrate dev --name add_lead_model
```

### Testing Checklist

- [ ] Test marketing domain (complyvault.co) - public access
- [ ] Test app domain (app.complyvault.co) - protected access
- [ ] Test trial request endpoint - stores lead, sends emails, no session
- [ ] Test protected API routes - require auth, email verification, workspace, entitlements
- [ ] Test email verification requirement
- [ ] Test workspace membership requirement
- [ ] Test entitlements (trial expired, subscription inactive)
- [ ] Test rate limiting on trial request endpoint
- [ ] Test middleware domain detection

## Matcher Patterns

### Middleware Matcher
The middleware matcher pattern remains:
```
"/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"
```

This matches all routes except static assets.

### Public Routes (Marketing Domain)
- `/` - Homepage
- `/uk` - UK homepage
- `/api/trial/request` - Trial request endpoint
- `/api/auth/*` - Auth endpoints

### Public Routes (App Domain)
- `/auth/*` - Auth pages
- `/api/auth/*` - Auth.js endpoints
- `/api/billing/webhook` - Stripe webhook
- `/api/health` - Health check (if exists)
- `/invitations/*` - Invitation acceptance pages

## Files Changed

### Created
- `src/server/auth/guards.ts` - Access guard functions
- `src/app/api/trial/request/route.ts` - Trial request endpoint
- `ACCESS_CONTROL_IMPLEMENTATION.md` - This document

### Modified
- `src/middleware.ts` - Domain detection and routing
- `prisma/schema.prisma` - Added Lead model
- `src/app/(app)/layout.tsx` - Server-side protection
- `src/app/api/upload/init/route.ts` - Use requireAppAccess()
- `src/app/api/upload/complete/route.ts` - Use requireAppAccess()
- `src/app/api/meetings/[id]/edit/route.ts` - Use requireAppAccess()
- `src/app/api/meetings/[id]/finalize/route.ts` - Use requireAppAccess()
- `src/app/api/search/route.ts` - Use requireAppAccess()

## Next Steps

1. **Create database migration** for Lead model
2. **Update remaining API routes** to use `requireAppAccess()`
3. **Handle special cases** (workspace creation, invitation acceptance)
4. **Test thoroughly** in staging environment
5. **Deploy to production** after verification

## Security Notes

- Middleware provides UX (redirects) but is NOT security
- `requireAppAccess()` guard is the actual security enforcement
- All protected API routes must use `requireAppAccess()`
- Email verification is required for app access
- Workspace membership is required for app access
- Entitlements (trial/subscription) are checked for app access
- Trial request endpoint does NOT create sessions (prevents auto-login)
