---
description: Rebuild the ComplyVault dashboard typography and chart layer (Inter, tabular figures, shadcn/Recharts ChartFrame, selective Tremor components)
---

Save as `.cursor/commands/dashboard-charts.md` and invoke with `/dashboard-charts`, or paste the body below into Agent mode.

Before running: put `complyvault-dashboard-viz-spec.md` in the repo at `docs/design/dashboard-viz-spec.md`. This command handles the foundation and defers all chart semantics to that file.

---

You are working in the ComplyVault repo (Next.js on Vercel). Read `docs/design/dashboard-viz-spec.md` first. It defines what each dashboard card should show and why. This command builds the typography and chart foundation that spec depends on. Do not start rebuilding individual cards until Phases 1 and 2 are merged.

Work one phase at a time. Report and stop at the end of each.

## Phase 0: verify (no code yet)

Report on: Tailwind version, React version, whether shadcn is initialised (`components.json`, `cn`, CSS variable tokens), whether `recharts` is installed and at which major, the current font setup, and the current first-load JS for `/dashboard`. Flag anything that blocks the phases below. Then stop.

## Phase 1: typography foundation

The dashboard is a numbers screen and its numbers currently do not align in columns. Fix that first, because it changes the feel of every card at near-zero risk.

1. Load Inter through `next/font` and expose it as a CSS variable:

```tsx
// app/layout.tsx
import { Inter } from "next/font/google";
const inter = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
```

Wire `--font-sans` into the Tailwind theme so `font-sans` resolves to it. Do not add a second display face. The hierarchy on this screen comes from weight and size, not from a font pairing.

2. Add a tabular numerals utility and apply it to every element that renders a figure:

```css
@utility tabular { font-variant-numeric: tabular-nums; }
```

Apply it to: the six Supervision selectivity values, the Compliance Health score and component point values, the Flag Activity and Flag Aging figures, Dispositions counts, Time to Finalize figures, the Audit Readiness fraction, all chart axis ticks, all tooltip values, all numeric table cells, and badge counts. Do not apply it to prose or headings.

3. Set a dashboard type scale in one place and use it everywhere: display figure, card title, metric label, axis tick, caption. Labels like PROCESSED and CLEARED / DEPRIORITISED are currently all-caps at low contrast. Move them to sentence case and check them against 4.5:1.

Acceptance: screenshot the Supervision selectivity strip before and after. Digits must sit in fixed-width columns. Report both screenshots.

## Phase 2: chart foundation

1. Install the shadcn chart component. Pin the Recharts major explicitly in `package.json` and note which one you pinned, because the shadcn chart wrapper moved to Recharts 3 and the two versions fail subtly rather than loudly (tooltips misbehaving, charts rendering at zero height). If on React 19, add the `react-is` override matching your exact React version.

2. Replace the default `--chart-1` through `--chart-5` categorical tokens with semantic ones. This dashboard has no arbitrary series. Define, in the brand palette:

   `--chart-cleared`, `--chart-sampled`, `--chart-priority`, `--chart-held`, `--chart-remediation`, `--chart-breach`

   Red is reserved for `--chart-breach` and nothing else. Every token must remain distinguishable in greyscale and under deuteranopia simulation. Test both and report the results.

3. Build `src/components/charts/ChartFrame.tsx` as the single wrapper every chart on the page goes through. It owns:

   - **Header**: title, period label, and an optional right-hand action slot.
   - **Shared tooltip**: one component, one behaviour. Vertical cursor line on time series, snap-to-element on categorical. Contents: period header, then one row per series with colour swatch, label, and a `tabular` value, then a footer line reading "Click to view N records". 60ms open delay, no exit delay.
   - **Click-through contract**: each series declares the filter it maps to. Clicking any element routes to the record list with that filter as a URL parameter, and the destination shows a dismissible filter chip. Build this before styling anything, because it is the load-bearing piece.
   - **Keyboard**: one tab stop per chart, arrow keys move between data points with a visible focus ring and the tooltip mirrored to the focused element, Enter opens the filtered list, Escape clears selection.
   - **Hidden data table**: same figures as the chart, for screen readers and for the evidence export.
   - **States**: loading (shimmer at final dimensions, no layout shift), empty (name what would fill it), low-n (below n=25 render the record list instead of the chart), stale or error (say which query failed, offer retry).
   - **Export as evidence**: overflow action producing the chart image, underlying record IDs, query parameters, generated-at timestamp and workspace hash.

4. Two defaults, applied globally and non-negotiable:

   - `isAnimationActive={false}` on every Recharts series. Tremor's own chart components do this, and it is correct here: figures a CCO may screenshot for an examiner must not animate in.
   - `accessibilityLayer` enabled on every chart, which covers a large part of the keyboard and screen reader requirement without custom work.

   Respect `prefers-reduced-motion` on the tooltip as well as the chart.

Acceptance: one card migrated to `ChartFrame` end to end, with hover, click-through to a filtered list, keyboard navigation and the data table all working. Report the bundle delta against Phase 0.

## Phase 3: selective Tremor components

Copy in four components from the Tremor copy-paste library (tremorlabs/tremor, not the `@tremor/react` npm package, which requires Tailwind 3 and does not support React 19):

| Component | Used for |
| --- | --- |
| Tracker | Supervision status by day, replacing the near-empty Flag Activity bar chart as a secondary strip |
| BarList | Dispositions, and the Compliance Health points-lost ranking |
| ProgressCircle | The 56/100 health score, which currently has no visible scale |
| Date range picker | The time window control, since three different windows are visible on the page at once |

Rules: copy the source into `src/components/ui/`, re-tokenise to the semantic palette from Phase 2, retain the licence header, and add a `THIRD_PARTY.md` entry recording the project, its licence and the commit copied. Do not install `@tremor/react`. Do not import Tremor's colour utilities; they carry their own palette conventions and will fight the tokens.

If any copied component pulls in a Radix primitive already present via shadcn, deduplicate rather than adding a second version.

## Phase 4: rebuild the cards

Only now, and strictly per `docs/design/dashboard-viz-spec.md`. Follow the priority order in section 7 of the spec. Section 0 of the spec lists contradictory figures across cards. If those are still unreconciled when you reach this phase, stop and report rather than building charts on numbers that disagree.

## Checks before each phase is considered done

1. `typecheck` clean.
2. Full test suite passing. Update tests whose asserted markup changed, do not weaken them.
3. Keyboard pass on every changed screen: tab order, focus visibility, Escape, focus return.
4. Reduced-motion pass: no animation, no layout jump.
5. Greyscale and colour-blind pass on every chart.
6. Bundle delta against the Phase 0 baseline. Flag anything above 15kb gzipped per screen.

## Report back

Files added, changed and deleted. Bundle delta. Any guardrail you could not satisfy and what you did instead. Any place you were tempted to add motion or decoration and chose not to.
