---
name: complyvault-frontend-standards
description: Frontend engineering standards for ComplyVault — App Router pages, React components, forms, loading/error states, brand tokens. Use when creating or modifying anything in src/app (pages/layouts), src/components, or src/hooks.
---

# ComplyVault Frontend Standards

## Stack

Next.js App Router (React 19), Tailwind CSS 4, Radix primitives + shadcn-style components in `src/components/ui/`, lucide-react icons, sonner for toasts, React Hook Form + Zod resolver, recharts for charts.

## Page structure

Every new route gets three files:

```
src/app/(app)/[route]/
  page.tsx      ← server component; fetch data server-side
  loading.tsx   ← skeleton matching the page layout
  error.tsx     ← error boundary (mandatory for compliance-critical UI)
```

- Server components by default. `"use client"` only for event handlers, hooks, or browser APIs — extract interactive logic to `src/components/<Feature>/<Feature>Client.tsx`.
- Authenticated app pages live under `src/app/(app)/`. Reuse `app-sidebar.tsx`, `top-bar.tsx`, and existing layout components — don't invent new shells.
- No business logic in `src/components/` or `src/hooks/`; call server modules from the page or via API routes.

## Brand

DARK_GREEN `#0D2818` (primary surfaces), ACCENT_GREEN `#2ECC71` (accents/CTAs). Use existing Tailwind theme tokens rather than hardcoding hex values in new components.

## Forms

React Hook Form + `zodResolver`; the Zod schema is the source of truth and should match the server-side schema. Show field-level errors; handle loading/success/error states; never rely on a disabled submit button alone.

## Compliance-specific UI language

- AI outputs are **triage signals** — never label them "finding", "violation", or "determination" in UI copy. A Finding exists only after human escalation.
- AI-generated text (summaries, rationales) is always visibly labelled as AI-drafted and pending review until signed off.
- SEC/regulatory copy comes from pre-approved template strings only — never write new regulatory citations into UI text.
- Destructive-looking actions (dismiss, override, bulk actions) always require a reason input when the backlog story says so, and surface that the action is audit-logged.

## Lists and queues

Review queues and evidence lists are the core UX. Requirements from the backlog:

- Queue actions (approve/dismiss/escalate) work without full page reloads — optimistic updates or router refresh, target: 50 items per session friction-free.
- Paginate/virtualise anything that can exceed ~100 rows (timelines reach 10k+ items).
- Filters (category, adviser, client, date, tag) live in the URL query string so views are shareable and back-button safe.

## Accessibility & polish

Radix primitives for anything interactive (dialogs, menus, selects). Keyboard operability for queue review flows — reviewers live in these screens. Empty states explain what will appear and how to get there, not just "No data".
