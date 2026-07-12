---
name: complyvault-testing
description: Testing standards for ComplyVault — vitest unit tests, Cypress E2E, compliance-critical coverage requirements, tenancy isolation tests. Use when writing tests, when a story reaches its testing step, or when the user asks to test a feature.
---

# ComplyVault Testing

Runner: `vitest` (`npm test`), config in `vitest.config.ts`. E2E: Cypress (`npm run test:e2e`). Typecheck is a gate too: `npm run typecheck`.

## Coverage requirements by code type

| Code | Required tests |
| --- | --- |
| Any server procedure/endpoint | ≥1 happy path |
| Compliance-critical logic (audit logging, hash chain, classification, export, retention, sign-off gating) | Happy path **and** error path |
| Tenancy-scoped queries | Isolation test: forged/foreign `workspaceId` returns zero rows |
| Parsers (WhatsApp, SMS, Teams/Slack) | Fixture-file tests incl. malformed lines — unparsed input preserved, never dropped |
| Export generation | Determinism test: same input twice → identical manifest hash |

## Compliance invariant tests (write these per story)

The backlog's acceptance criteria are the test list — turn each bullet into a test name. Additionally, standing invariants worth asserting wherever touched:

- Every mutation under test writes its audit event (assert on the audit table, not just the response).
- Soft delete: after "delete", the row still exists with `deletedAt` set; queries exclude it.
- Hash chain: appending N events then verifying the chain passes; tampering with one payload makes verification fail.
- Redaction guard: a test proves classification cannot be invoked with un-redacted content (module boundary, not convention).
- Dismiss without reason code is rejected; nothing exposes a hard-delete path for signals or evidence.

## Fixtures

- Fictional data only: fake firm names, fake CRD numbers, `example.com` addresses. Never real client data or plausible-looking PII in fixtures.
- Email fixtures: cover reply/forward/subject-change threading cases; a dedupe case with a repeated `internetMessageId`.
- Classification fixtures: at least one message per taxonomy category plus clean negatives.
- Keep fixtures in `__fixtures__/` next to the code under test.

## Style

- Test files co-located: `foo.test.ts` beside `foo.ts`.
- Test the observable contract (DB rows, returned DTOs, emitted events) — not implementation internals.
- LLM calls are mocked at the redaction-guard boundary; classification logic tests use canned model outputs, including a malformed-output case (must retry then dead-letter).
- Time-dependent logic (retention dates, aging alerts) uses injected clocks — `vi.setSystemTime`, no sleeps.
