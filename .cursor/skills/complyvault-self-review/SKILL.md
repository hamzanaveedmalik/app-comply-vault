---
name: complyvault-self-review
description: Compliance-focused self-review checklist run after implementing any ComplyVault change, before declaring a story done or committing. Use after completing a story, before a commit or PR, or when the user asks to review changes.
---

# ComplyVault Self-Review

Run this against the diff (`git diff` + untracked files) after implementation. Report findings as 🔴 must fix / 🟡 should fix / 🟢 note, then fix all 🔴 before declaring done.

## 1. Gates

```bash
npm run typecheck && npm test
```

Both must pass. Report failures verbatim — never declare a story done with failing gates.

## 2. Compliance audit of the diff

- [ ] Every create/update/delete of compliance data writes an audit event in the same transaction.
- [ ] No hard deletes on evidence-linked models — `deletedAt` only; no `prisma.<model>.delete(` in the diff (except join/ephemeral tables).
- [ ] No client names, emails, or financial figures in `console.*`, thrown errors, or log payloads — entity IDs only.
- [ ] No new path that disables capture, filters ingestion by content, or deletes classification signals.
- [ ] AI outputs worded as "signals" in schema/UI; no AI-generated regulatory citations; AI drafts labelled as drafts.
- [ ] Exports: deterministic, validated for required SEC fields, sign-off gates intact, EXPORT events written.

## 3. Security & tenancy

- [ ] Every new query on tenant-scoped models filters by `workspaceId` derived from the session — grep the diff for `prisma.` calls and verify each.
- [ ] New routes validate session + membership; no sensitive endpoint is unauthenticated.
- [ ] Secrets/tokens: encrypted at rest, never logged, never in client bundles. No `.env` changes committed (update `.env.example` instead).
- [ ] External input (webhooks, uploads, OAuth callbacks) parsed with Zod before use.

## 4. Code standards

- [ ] No `any`, no bare `as` casts (`// CAST: reason` if unavoidable), explicit return types on exported functions.
- [ ] Business logic in `src/server/`, not route handlers or components; DTOs at the boundary, not Prisma models.
- [ ] Schema changed? Migration command surfaced to the user; models have `createdAt`/`updatedAt`/`deletedAt`.
- [ ] New/changed logic has the tests required by `complyvault-testing` (error paths for compliance-critical code).

## 5. Story closure

- [ ] Each acceptance criterion in the backlog story is demonstrably met — walk the list explicitly in the summary.
- [ ] Story status marker updated in `docs/product/backlog-epics-and-stories.md`.
- [ ] Anything ⚠️ COMPLIANCE IMPACT restated in the final summary to the user.
- [ ] Commit message (if asked to commit): `[scope] action: description`.
