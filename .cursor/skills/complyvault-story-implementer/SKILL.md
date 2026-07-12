---
name: complyvault-story-implementer
description: Implements ComplyVault backlog stories (CV-0-xx, CV-A-xx through CV-E-xx) end-to-end from docs/backlog-epics-and-stories.md. Use when the user asks to implement, build, or start a story or epic, e.g. "implement CV-B-03", "build the review queue", "start Phase 2", or references the backlog or PRD.
---

# ComplyVault Story Implementer

Orchestrates implementation of a backlog story. Delegates domain rules to the other `complyvault-*` skills — read the relevant ones before writing code.

## Sources of truth

- Backlog: `docs/backlog-epics-and-stories.md` (story IDs, acceptance criteria, dependency graph, phase table)
- PRD: `docs/# PRD — ComplyVault Communications & Exa.md` (schema in §9, module specs)
- Design principle: selectivity at the documentation layer, never the capture layer. AI outputs are triage signals, not findings.

## Workflow

Copy this checklist and track progress:

```
Story CV-X-NN progress:
- [ ] 1. Load story + acceptance criteria from backlog
- [ ] 2. Verify dependencies are built (dependency graph at bottom of backlog)
- [ ] 3. Read the relevant standards skills
- [ ] 4. Plan: schema → server → UI → tests
- [ ] 5. Implement
- [ ] 6. Gates: npm run typecheck && npm test
- [ ] 7. Run complyvault-self-review skill
- [ ] 8. Mark story status in backlog file
```

**Step 2 — dependencies.** If a prerequisite story (e.g. CV-A-10 scope policy before CV-C-02 classification) is not implemented, stop and tell the user which one blocks, with the option to stub it behind an interface.

**Step 3 — standards.** Read before coding:

| Touching | Read skill |
| --- | --- |
| Prisma schema, server logic, API, jobs | `complyvault-backend-standards` |
| Pages, components, forms | `complyvault-frontend-standards` |
| Classification, LLM calls, redaction | `complyvault-ai-pipeline` |
| PDF/ZIP export, manifests | `complyvault-export-pipeline` |
| Tests | `complyvault-testing` |

**Step 4 — plan.** Schema changes first (surface `npx prisma migrate dev --name <name>` + `npx prisma generate` to the user), then server, then UI, then tests. Acceptance criteria from the backlog become the test list.

**Step 8 — status.** Append a status marker to the story heading in the backlog, e.g. `### CV-B-03 · ... — P0 · XL ✅ done (2026-07-13)` or `🔨 in progress`.

## Hard rules (never trade away)

- Stories flagged ⚠️ COMPLIANCE IMPACT: repeat the flag in your summary to the user.
- CV-C-05 requires legal review of the retention tier before build — do not implement retention-expiry behaviour without user confirmation that review happened.
- Never build a path that disables capture, deletes signals outside documented retention tiers, or cherry-picks ingestion by content.
- Every mutation of compliance data writes an audit event; soft delete only; no PII in logs.
