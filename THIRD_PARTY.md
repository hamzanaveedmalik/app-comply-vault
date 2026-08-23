# Third-party notices

## beUI

- **Source:** [beUI](https://beui.dev) — MIT-licensed animated React components (Motion + Tailwind)
- **Registry:** https://beui.dev/r/{slug}.json
- **Components copied into this repo (Aug 2026):**
  - `button-stateful` → `src/components/ui/stateful-button.tsx`
  - `animated-toast-stack` → `src/components/ui/animated-toast-stack.tsx`
  - `animated-number` → `src/components/ui/animated-number.tsx`
  - `text-shimmer` → `src/components/ui/text-shimmer.tsx`, `src/lib/text-shimmer.ts`
  - `tabs` → `src/components/ui/tabs.tsx`
  - `table` → `src/components/ui/data-table/` (read-only virtualized lists)
  - `file-upload` → `src/components/ui/file-upload.tsx`
  - Priority Inbox virtual table → `src/components/supervision/priority-inbox-findings-table.tsx` (read-only, `@tanstack/react-virtual`)
  - `presence-gate` → `src/lib/presence-gate.tsx`
- **Author:** Saurabh (beUI registry metadata)
- **License:** MIT

Adapted for ComplyVault: brand token mapping, reduced-motion guardrails, duration caps in `src/components/ui/motion-config.ts`.
