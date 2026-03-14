---
name: complyvault
description: ComplyVault RIA compliance platform workflows. Use when creating tRPC routers, Prisma models, SEC audit pack exports, App Router pages, forms with validation, audit trail logging, demo/onboarding data, or deployment checklists.
---

# ComplyVault — Cursor Skills

ComplyVault is a compliance documentation platform for RIAs. All workflows must preserve regulatory accuracy and audit trail integrity.

---

## 1. Generate tRPC Router

**Trigger**: "create a tRPC router for [domain]" or "add a new procedure for [feature]"

1. Create `src/server/[domain]Router.ts`
2. Import `router`, `protectedProcedure`, `publicProcedure` from `src/server/trpc`
3. Define input schema with Zod
4. Implement procedure with `TRPCError` for errors
5. Register router in `src/server/root.ts`
6. Return typed DTO — never raw Prisma model

```typescript
import { z } from "zod";
import { router, protectedProcedure } from "./trpc";
import { TRPCError } from "@trpc/server";

export const [domain]Router = router({
  [action]: protectedProcedure
    .input(z.object({ /* schema */ }))
    .mutation(async ({ ctx, input }) => {
      try {
        // business logic
        return { success: true, data: result };
      } catch (error) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "..." });
      }
    }),
});
```

---

## 2. Prisma Model + Migration

**Trigger**: "add a [ModelName] model" or "update the schema for [feature]"

1. Add model to `prisma/schema.prisma`
2. Include: `id`, `createdAt`, `updatedAt`, `deletedAt` (soft delete)
3. Add indexes for query patterns
4. Run: `npx prisma migrate dev --name [descriptive-name]`
5. Run: `npx prisma generate`
6. Create DTO in `src/lib/types.ts` mapping from Prisma model

```prisma
model [ModelName] {
  id        String   @id @default(cuid())
  // fields
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  deletedAt DateTime?

  @@index([/* relevant fields */])
}
```

---

## 3. SEC Audit Pack Export

**Trigger**: "generate audit pack" or "export compliance document" or "create SEC export"

1. Pull data via Prisma — never trust client-passed data for regulatory documents
2. Validate required SEC fields before generating
3. Use `src/server/export/pdf.ts` for PDF generation
4. Log export to audit trail (required)
5. Return signed URL or buffer — never expose raw file paths
6. Use `src/lib/topics.ts` for approved topic normalizations

**Required SEC fields**: Meeting date/time (ISO 8601), participant names and roles, firm CRD number, agenda topics (normalized), action items with owners, document version and generation timestamp.

**Audit log** (always create):

```typescript
await ctx.prisma.auditEvent.create({
  data: {
    workspaceId,
    userId: ctx.session.user.id,
    action: "EXPORT",
    resourceType: "meeting",
    resourceId: meetingId,
    meetingId,
    metadata: { exportedAt: new Date().toISOString(), exportFormat: "audit_pack_zip" },
  },
});
```

---

## 4. Add a UI Page (App Router)

**Trigger**: "create a page for [feature]" or "add a [name] screen"

1. Create `src/app/[route]/page.tsx` as server component
2. Create `src/app/[route]/loading.tsx` with skeleton
3. Create `src/app/[route]/error.tsx` for error boundary
4. Data fetching: use tRPC server-side caller or pass to client component
5. Interactive logic: extract to `src/components/[Feature]/[Feature]Client.tsx`
6. Use existing layout components

```
app/[route]/
  page.tsx        ← server component
  loading.tsx     ← skeleton
  error.tsx       ← error boundary
components/[Feature]/
  [Feature]Client.tsx   ← "use client"
```

---

## 5. Form with Validation

**Trigger**: "create a form for [entity]" or "add input form for [feature]"

1. Define Zod schema first (source of truth)
2. Use React Hook Form with `zodResolver`
3. Wire to tRPC mutation: `api.[router].[procedure].useMutation()`
4. Handle loading, success, error states
5. Show field-level errors — never rely only on disabled submit

```typescript
"use client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { api } from "~/lib/api";

const schema = z.object({ /* fields */ });
type FormData = z.infer<typeof schema>;

export function [Name]Form() {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });
  const mutation = api.[router].[procedure].useMutation();

  const onSubmit = async (data: FormData) => {
    await mutation.mutateAsync(data);
  };

  return <form onSubmit={handleSubmit(onSubmit)}>{/* fields */}</form>;
}
```

---

## 6. Audit Trail Logger

**Trigger**: "log this action" or "add audit trail for [action]" or "track this compliance event"

1. Log for: document creation, exports, sensitive record access, deletions
2. Append-only — never update or delete audit entries
3. Use `prisma.auditEvent.create` with: `workspaceId`, `userId`, `action`, `resourceType`, `resourceId`, `metadata`, optional `meetingId`

**AuditAction enum** (from schema): `UPLOAD`, `VIEW`, `EDIT`, `FINALIZE`, `EXPORT`, `DELETE`, `REMEDIATION_START`, `REMEDIATION_UPDATE`, `TASK_UPDATE`, `EVIDENCE_ADD`, `VERIFICATION`, `OVERRIDE`, `WORKSPACE_CREATED`, `INVITE_SENT`, `INVITE_RESENT`, `INVITE_ACCEPTED`, `MEMBER_REMOVED`

---

## 7. Onboarding / Demo Mode

**Trigger**: "set up demo data" or "seed demo account" or "create sample client for demo"

1. Use or create `scripts/seed-demo.ts`
2. Mark demo records with `isDemo: true` (add field if needed)
3. Production queries: always filter `where: { isDemo: false }`
4. Demo clients: fictional firm names and CRD numbers only
5. Demo audio/transcripts: pre-recorded fixtures, not live recordings

---

## 8. Deployment Checklist

**Trigger**: "deploy to staging" or "promote to production" or "release [feature]"

**Staging**:
- [ ] `npx prisma migrate deploy`
- [ ] Env vars verified in Vercel
- [ ] Export pipeline tested with real audit pack
- [ ] No `console.log` with PII
- [ ] Audit trail entries verified in staging DB

**Production**:
- [ ] Staging smoke test passed
- [ ] DB backup before migration
- [ ] PR reviewed and approved
- [ ] Merge `staging` → `main` via PR (no force push)
- [ ] Monitor Vercel deployment logs for 10 minutes post-deploy
