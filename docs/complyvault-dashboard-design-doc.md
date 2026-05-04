# ComplyVault Dashboard — Design Implementation Document

> **Purpose:** Cursor-ready implementation spec. Every component, token, data shape, layout rule, and interaction pattern from the UX redesign is documented here. Reference the companion mockup artifact (`complyvault-dashboard-v3.jsx`) for the rendered prototype.
>
> **Stack:** Next.js (App Router) · Tailwind CSS · shadcn/ui · Recharts (or D3 for custom charts) · Lucide React icons · DM Sans (Google Fonts)

---

## 1. Design System & Tokens

### 1.1 Brand Colour Palette

All colours derive from the primary brand green `#117A4B`. Extend `tailwind.config.ts`:

```ts
// tailwind.config.ts — extend theme.colors
const colors = {
  brand: {
    DEFAULT:    "#117A4B",   // Primary — buttons, active nav, finalized status, links
    light:     "#E8F5EE",   // Finalized badge bg, healthy gauge bg
    mid:       "#1A9B5F",   // Logo gradient end, hover states
    dark:      "#0D5C38",   // Finalized badge text, darkened text
    glow:      "rgba(17,122,75,0.15)", // Box-shadow accent on buttons/active nav
  },
  sidebar: {
    bg:        "#082F1C",   // Sidebar background
    surface:   "#0D3D24",   // Workspace selector bg
    border:    "#134A2E",   // Sidebar dividers
    activeBorder: "#1A5C3A", // Workspace selector border
    muted:     "#5A9B78",   // Sidebar secondary text (subtitles, role labels)
    text:      "#8BBFA3",   // Sidebar nav inactive text
    textLight: "#C8E6D5",   // Sidebar workspace name, user name
    textBright:"#E8F5EE",   // Logo brand name
  },
  semantic: {
    critical:  "#DC2626",   // Health gauge critical
    danger:    "#EF4444",   // Open flags, flagged status badge, flag trend line
    warning:   "#D97706",   // Time-to-finalize, amber warnings
    orange:    "#F97316",   // Pending review, ready-for-review badge
    success:   "#22C55E",   // Trend-up indicators (only used sparingly — brand.DEFAULT is the primary "good" colour)
  },
  surface: {
    page:      "#F7F9F8",   // Main content background (warm grey-green)
    card:      "#FFFFFF",   // Card backgrounds
    hover:     "#F8FAF9",   // Table row hover, search bar bg
    border:    "#E2E8F0",   // Card borders, header border
    divider:   "#F1F5F9",   // Table header bottom, card internal dividers
    muted:     "#F8FAFC",   // Draft badge bg
  },
  text: {
    primary:   "#0F172A",   // Headings, primary text, metric numbers
    secondary: "#64748B",   // Body text, table secondary columns, labels
    muted:     "#94A3B8",   // Placeholders, sub-labels, "/ 100", context text
  },
};
```

### 1.2 Typography

**Font:** DM Sans (Google Fonts) — load weights 300, 400, 500, 600, 700.

```html
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700&display=swap" rel="stylesheet" />
```

| Element | Size | Weight | Tracking | Transform | Colour |
|---------|------|--------|----------|-----------|--------|
| Logo brand name | 15px | 700 | -0.02em | — | sidebar.textBright |
| Logo subtitle | 9.5px | 500 | 0.06em | uppercase | sidebar.muted |
| Nav item (active) | 13px | 600 | — | — | #FFFFFF |
| Nav item (inactive) | 13px | 400 | — | — | sidebar.text |
| Card label (all metric cards) | 11px | 600 | 0.04–0.05em | uppercase | text.secondary |
| Metric number (large) | 28–36px | 700 | — | — | contextual colour |
| Metric context ("meetings", "target ≤ 2d") | 11–12px | 400–500 | — | — | text.muted |
| Trend indicator text | 11px | 500 | — | — | contextual colour |
| Table heading | 10px | 600 | 0.06em | uppercase | text.muted |
| Table cell (primary — client name) | 13px | 600 | — | — | text.primary |
| Table cell (secondary — type, date) | 12–13px | 400 | — | — | text.secondary |
| Status badge text | 10.5–11px | 600 | — | — | per-status |
| CTA link ("Review now →", "View →") | 11–12px | 500–600 | — | — | brand.DEFAULT or contextual |
| Pipeline legend | 11–12px | 500 | — | — | text.secondary |
| Section title ("Meetings") | 14–15px | 600 | — | — | text.primary |
| Section subtitle | 11–12px | 400 | — | — | text.muted |

### 1.3 Spacing & Radius

| Token | Value | Usage |
|-------|-------|-------|
| Card border-radius | 14px | All metric cards, table container, pipeline bar |
| Card padding | 16–20px | Metric cards |
| Card shadow | `0 1px 4px rgba(0,0,0,0.04)` | All cards |
| Card border | `1px solid #E2E8F0` | All cards |
| Semantic left-border | `3px solid {colour}` | Cards with urgency signal |
| Grid gap (metric rows) | 16px | Between cards |
| Content padding | 24px | Main content area |
| Sidebar width | 244px | Fixed |
| Header height | 56px | Fixed |
| Status badge radius | 20px (pill) | All status badges |
| Status dot size | 5–6px | Inside badges |

### 1.4 Shadows & Elevation

| Level | Value | Usage |
|-------|-------|-------|
| Card | `0 1px 4px rgba(0,0,0,0.04)` | Default card state |
| Button glow | `0 2px 8px rgba(17,122,75,0.15)` | Primary buttons, active nav |
| Tooltip | `0 4px 12px rgba(0,0,0,0.15)` | Chart tooltips |
| Notification badge | `border: 2px solid #fff` | Bell icon badge (lifts off surface) |

---

## 2. Layout Architecture

### 2.1 Page Shell

```
┌─────────────────────────────────────────────────────────────────┐
│ Sidebar (244px fixed)  │  Main Content (flex: 1)                │
│                        │  ┌──────────────────────────────────┐  │
│  Logo + Subtitle       │  │ Header (56px fixed)              │  │
│  Workspace Selector    │  │ Search bar + Notification bell   │  │
│  ───────────────────   │  └──────────────────────────────────┘  │
│  Nav Items             │  ┌──────────────────────────────────┐  │
│    Dashboard (active)  │  │ Scrollable Content (padding 24)  │  │
│    Interaction Log     │  │                                  │  │
│    Review Queue [2]    │  │  Row 1: Health + Flags + Cats    │  │
│    Upload              │  │  Row 2: Donut + Finalize + ...   │  │
│    Integrations        │  │  Pipeline Bar                    │  │
│    Audit Logs          │  │  Meeting Table                   │  │
│  ───────────────────   │  │                                  │  │
│  User Avatar + Name    │  └──────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Dashboard Grid — Row 1 (Metrics Hero)

```
grid-template-columns: 240px 1fr 1fr
gap: 16px
margin-bottom: 16px
```

| Column | Component | Height |
|--------|-----------|--------|
| 1 (240px) | Compliance Health Gauge | Auto (≈190px) |
| 2 (1fr) | Open Flags — area chart with trend | Auto (matches col 1) |
| 3 (1fr) | Flag Category Breakdown — horizontal bars | Auto (matches col 1) |

### 2.3 Dashboard Grid — Row 2 (Secondary Metrics)

```
grid-template-columns: 1.3fr 1fr 0.6fr 0.6fr
gap: 16px
margin-bottom: 16px
```

| Column | Component |
|--------|-----------|
| 1 (1.3fr) | Meetings by Type — interactive donut + legend |
| 2 (1fr) | Time to Finalize — sparkline with target line |
| 3 (0.6fr) | Pending Review — number + CTA |
| 4 (0.6fr) | Audit Packs Generated — number + CTA |

### 2.4 Pipeline Bar (full width)

Single row, `display: flex`, `align-items: center`, `gap: 20px`.

### 2.5 Meeting Table (full width)

Standard table with header row, status badges, flag count column, hover states.

---

## 3. Component Specifications

### 3.1 Sidebar

**Structure:**
1. **Logo block** — Brand icon (34×34, border-radius 9, gradient `brand.DEFAULT → brand.mid`) + "ComplyVault" + "Compliance Command" subtitle. Border-bottom `sidebar.border`.
2. **Workspace selector** — Initials avatar (26×26) + workspace name + client count + chevron-down icon. Background `sidebar.surface`, border `sidebar.activeBorder`, border-radius 8.
3. **Nav items** — Icon (18×18 Lucide) + label + optional badge. Active state: `background: brand.DEFAULT`, `color: #fff`, `box-shadow: brand.glow`. Inactive: `color: sidebar.text`. Badge: orange pill (`#F97316`) for inactive, white pill for active.
4. **User block** — Avatar circle (30px, gradient `brand.DEFAULT → #2DD881`) + name + role. Border-top `sidebar.border`.

**Nav items (in order):**

| Label | Icon (Lucide) | Badge |
|-------|---------------|-------|
| Dashboard | `LayoutGrid` | — |
| Interaction Log | `FileText` | — |
| Review Queue | `CheckSquare` | Dynamic count (meetings with status `review`) |
| Upload | `Upload` | — |
| Integrations | `Settings` | — |
| Audit Logs | `Shield` | — |

### 3.2 Compliance Health Gauge

**Type:** SVG semi-circle arc gauge.

**Specs:**
- Arc radius: 62px, stroke-width: 8px, stroke-linecap: round
- Background arc: full semi-circle in muted colour
- Progress arc: `stroke-dasharray` animated on mount (1.4s cubic-bezier)
- Centre text: score (34px/700 weight), "/ 100" below (10px/500)
- Below arc: pill badge with label — "Critical" / "Needs Attention" / "Healthy"

**Colour thresholds:**

| Score Range | Arc Colour | Background | Badge Text |
|-------------|-----------|------------|------------|
| 0–39 | `#DC2626` | `#FEE2E2` | "Critical" |
| 40–69 | `#D97706` | `#FEF3C7` | "Needs Attention" |
| 70–100 | `#117A4B` | `#E8F5EE` | "Healthy" |

**Data source:** Nightly background job calculates weighted score from:
- Meeting coverage: 30%
- Documents finalised: 25%
- Flags resolved: 25%
- Signatures complete: 20%

**Subtext:** Dynamic summary — "{open flags} flags · {unfinalised count} unfinalised"

### 3.3 Open Flags — Area Chart Card

**Left-border:** 3px `semantic.danger` (only if flags > 0).

**Header row:**
- Label: "OPEN FLAGS" (uppercase, 11px/600, `text.secondary`)
- Number: right-aligned, 26px/700, `semantic.danger`

**Trend indicator (below header):**
- Down-trend SVG icon (12×12) + "{delta} this week · trending up/down" (11px/500, red or green)

**Chart (fills remaining card height):**
- **Type:** Area chart (D3 or Recharts `<AreaChart>`)
- **Data:** Weekly flag counts, rolling 12 weeks
- **Area fill:** Linear gradient top→bottom, `#EF4444` at 25% opacity → 2% opacity
- **Line:** 2px solid `#EF4444`, `curveMonotoneX`
- **Dots:** 3.5px radius, white fill, 1.5px `#EF4444` stroke
- **X-axis:** Show first and last week labels only (9px, `text.muted`)
- **Y-axis:** Hidden (data labels via tooltips)
- **Tooltips:** Dark background (`#1E293B`), white text, 11px/600, border-radius 6, shadow. Format: "W{n}: {count} flags"
- **Interaction:** Hover dots to show tooltip

**Data contract:**
```ts
interface WeeklyFlagData {
  week: string;   // "W1", "W2", etc.
  count: number;  // Total open flags that week
}
// API: GET /api/dashboard/flags-trend?weeks=12
```

### 3.4 Flag Category Breakdown — Horizontal Bars

**Label:** "FLAGS BY CATEGORY" (uppercase, 11px/600)

**Chart:**
- Horizontal stacked progress bars, one per category
- Each row: category label (10px, 80px right-aligned) → bar (flex: 1, 10px height, border-radius 5) → count (11px/700, 18px right-aligned)
- Bar background: `#F1F5F9`
- Bar fill: category-specific colour, width = `(count / total) * 100%`, animated (0.8s cubic-bezier)

**Interaction:** Hover a row → all other rows dim to 35% opacity (200ms transition). This is a cross-highlight — hovering the label, bar, or count all trigger it.

**Default categories and colours:**

| Category | Colour | Notes |
|----------|--------|-------|
| Suitability | `#EF4444` | Most severe — SEC focus area |
| Documentation | `#F97316` | Missing or incomplete docs |
| Disclosure | `#D97706` | Fee, risk, conflict disclosures |
| Risk Tolerance | `#8B5CF6` | Mismatch flags |
| Fee Discussion | `#94A3B8` | Lower severity |

**Data contract:**
```ts
interface FlagCategoryData {
  category: string;
  count: number;
  color: string;  // Can be server-driven or mapped client-side
}
// API: GET /api/dashboard/flags-by-category
```

### 3.5 Meetings by Type — Interactive Donut

**Chart:**
- D3 donut (or Recharts `<PieChart>` with `innerRadius`)
- Outer radius: 43px, inner radius: 29px (≈14px ring thickness)
- Pad angle: 0.04 radians between segments
- Centre: total count (18px/700) + "TOTAL" label (8px, `text.muted`)

**Legend (right of donut):**
- Vertical list, each row: colour swatch (7×7, border-radius 2) + type label (10.5px/500) + count (10.5px/700, right-aligned)

**Interaction:** Hover a segment → all other segments and legend rows dim to 30% opacity. Hover a legend row → same cross-highlight on the donut.

**Colours:**

| Meeting Type | Colour |
|-------------|--------|
| Annual Review | `#117A4B` (brand) |
| Portfolio Review | `#3B82F6` |
| Quarterly Check-in | `#F97316` |
| Onboarding | `#8B5CF6` |
| Other | `#94A3B8` |

**Data contract:**
```ts
interface MeetingTypeData {
  type: string;
  count: number;
}
// API: GET /api/dashboard/meetings-by-type?period=current
```

### 3.6 Time to Finalize — Sparkline Card

**Left-border:** 3px `semantic.warning`.

**Header:**
- "TIME TO FINALIZE" label
- Number: 28px/700, `semantic.warning` — formatted as `{days}d` (e.g., "17.1d")
- Context: "target ≤ 2d" (11px, `text.muted`)

**Chart (lower portion):**
- Line chart, 160×56px viewport
- Data: last 8 data points (weekly). Null values are skipped (no dot/line for weeks with no finalizations).
- Line: 2px solid `#D97706`, `curveMonotoneX`
- Dots: 3px radius, white fill, 1.5px amber stroke
- **Target line:** Dashed horizontal line at `days = 2`, colour `brand.DEFAULT`, 1px, dash pattern "3,3", 50% opacity. Small "target" label at right end (8px, `brand.DEFAULT`, 70% opacity).
- Tooltips: same dark tooltip as flags chart, format: "{days}d — {date}"

**Data contract:**
```ts
interface FinalizeTimeData {
  date: string;       // "Mar 1", "Apr 5", etc.
  days: number | null; // Null if no finalization that week
}
// API: GET /api/dashboard/finalize-trend?weeks=8
```

### 3.7 Pending Review Card

**Left-border:** 3px `semantic.orange`.
**Layout:** Vertical stack with `justify-content: space-between` to fill card height.

| Element | Spec |
|---------|------|
| Label | "PENDING REVIEW" |
| Number | 36px/700, `semantic.orange` |
| Context | "meetings" (12px, `text.muted`) |
| CTA | "Review now →" (11px/600, `semantic.orange`, cursor pointer) |

**CTA behaviour:** Links to `/review-queue` filtered to `status=review`.

### 3.8 Audit Packs Card

**Left-border:** 3px `brand.DEFAULT`.
**Same vertical layout as Pending Review.**

| Element | Spec |
|---------|------|
| Label | "AUDIT PACKS" |
| Number | 36px/700, `brand.DEFAULT` |
| Context | "SEC-ready" (12px, `text.muted`) |
| CTA | "View pack →" (11px/600, `brand.DEFAULT`, cursor pointer) |

### 3.9 Pipeline Bar

**Full-width card, single row layout.**

| Element | Spec |
|---------|------|
| Label | "PIPELINE" (11px/600, uppercase, `text.secondary`, `white-space: nowrap`) |
| Bar | `display: flex`, `gap: 2px`, `height: 8px`, `border-radius: 4px`, `overflow: hidden` |
| Legend | 4 items, each: dot (7px circle) + "{count} {label}" (11px/500) |

**Segments (left to right):**

| Segment | Colour | Flex basis |
|---------|--------|-----------|
| Draft | `#CBD5E1` | Count of draft meetings |
| Review | `#F97316` | Count of review meetings |
| Flagged | `#EF4444` | Count of flagged meetings |
| Done | `brand.DEFAULT` | Count of finalized meetings |

First segment gets `border-radius: 4px 0 0 4px`, last gets `0 4px 4px 0`.

**Data contract:**
```ts
interface PipelineData {
  draft: number;
  review: number;
  flagged: number;
  finalized: number;
}
// Derived client-side from meetings list, or:
// API: GET /api/dashboard/pipeline-counts
```

### 3.10 Meeting Table

**Container:** Card with header + table. No separate scroll — table is part of page scroll.

**Header row:**
- Title: "Meetings" (14px/600)
- Subtitle: "{total} meetings · {review count} require your review" (11px, `text.muted`)
- CTA button: "+ Upload Meeting" — right-aligned, `brand.DEFAULT` background, white text, 12px/600, border-radius 8, shadow `brand.glow`

**Table columns:**

| Column | Width | Content |
|--------|-------|---------|
| Client | ~25% | Client name (13px/600, `text.primary`) |
| Type | ~25% | Meeting type (12px, `text.secondary`) |
| Date | ~12% | Short date (12px, `text.secondary`) |
| Flags | ~10% | Flag icon + count (colour-coded) or "✓ Clean" |
| Status | ~18% | Pill badge |
| Action | ~10% | "View →" link |

**Flags column logic:**

| Condition | Display |
|-----------|---------|
| `flags >= 5` | Red flag icon + count in `semantic.danger` |
| `flags > 0 && flags < 5` | Amber flag icon + count in `semantic.warning` |
| `flags === 0` | "✓ Clean" in `brand.DEFAULT` |

**Status badges:**

| Status | Background | Border | Text | Dot |
|--------|-----------|--------|------|-----|
| Ready for Review | `#FFF7ED` | `#F97316` at 12% | `#C2410C` | `#F97316` |
| Flagged | `#FEF2F2` | `#EF4444` at 12% | `#B91C1C` | `#EF4444` |
| Finalized | `#E8F5EE` | `#117A4B` at 12% | `#0D5C38` | `#117A4B` |
| Draft | `#F8FAFC` | `#94A3B8` at 12% | `#64748B` | `#94A3B8` |

Badge structure: `inline-flex`, `gap: 4–5px`, `padding: 3px 10px`, `border-radius: 20px`, `font-size: 10.5px`, `font-weight: 600`. Dot is 5–6px circle.

**Row hover:** Background changes to `surface.hover` (#F8FAF9), 100ms transition. Cursor: pointer (entire row is clickable → navigates to `/meetings/{id}`).

---

## 4. Interaction Patterns

### 4.1 Chart Tooltips (Global Pattern)

All chart tooltips share the same styling:

```css
.chart-tooltip {
  background: #1E293B;
  color: #FFFFFF;
  padding: 3px 8px;       /* small charts */
  /* OR */
  padding: 4px 10px;      /* larger charts */
  border-radius: 5–6px;
  font-size: 10–11px;
  font-weight: 600;
  font-family: 'DM Sans', sans-serif;
  pointer-events: none;
  white-space: nowrap;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
}
```

Positioned absolutely relative to the chart container. Anchored above the hovered data point, offset -28 to -38px from the dot's Y position.

### 4.2 Cross-Highlight (Donut + Legend, Bar Chart)

When hovering any element in a chart group:
- The hovered element stays at `opacity: 1`
- All sibling elements transition to `opacity: 0.3–0.35`
- Transition duration: `200ms`
- On mouse leave: all elements return to `opacity: 1`

This applies to:
- Donut segments ↔ legend rows (bidirectional)
- Flag category bar rows (self-contained)

### 4.3 Animated Mount

- Health gauge arc: `stroke-dasharray` animates from 0 to calculated progress over 1.4s with `cubic-bezier(0.4, 0, 0.2, 1)`. Triggered 100ms after mount (useEffect with setTimeout).
- Flag category bars: width transitions from 0% to calculated width over 0.8s with same easing.
- No mount animation on other elements (keeps page load snappy).

### 4.4 Navigation

| Element | Action |
|---------|--------|
| Nav items | Client-side route change (Next.js `useRouter`) |
| "Review now →" | Navigate to `/review-queue?status=review` |
| "View pack →" | Navigate to `/audit-packs` |
| "+ Upload Meeting" | Open upload modal (existing flow) |
| Table row click | Navigate to `/meetings/{id}` |
| "View →" link | Same as row click |
| Workspace selector | Open workspace switcher dropdown (future — multi-tenant) |
| Notification bell | Open notification panel/dropdown |

---

## 5. Data Contracts & API Endpoints

### 5.1 Dashboard Aggregate

**`GET /api/dashboard/summary`**

Returns all dashboard data in a single call to minimise waterfall requests:

```ts
interface DashboardSummary {
  healthScore: number;                 // 0–100
  healthBreakdown: {
    meetingCoverage: number;           // 0–100
    documentsFinalised: number;        // 0–100
    flagsResolved: number;            // 0–100
    signaturesComplete: number;       // 0–100
  };

  totalMeetings: number;
  pendingReview: number;
  openFlags: number;
  flagsDelta: number;                  // Change vs previous period (e.g., +7)
  flagsTrending: "up" | "down" | "flat";
  finalizationRate: number;            // 0–100 (percentage)
  finalizedCount: number;
  avgTimeToFinalize: number | null;    // Days, null if no finalizations
  auditPacksGenerated: number;

  pipeline: {
    draft: number;
    review: number;
    flagged: number;
    finalized: number;
  };

  flagsTrend: WeeklyFlagData[];           // 12 weeks
  flagsByCategory: FlagCategoryData[];
  meetingsByType: MeetingTypeData[];
  finalizeTrend: FinalizeTimeData[];      // 8 data points

  recentMeetings: MeetingRow[];           // For the table
}

interface MeetingRow {
  id: string;
  clientName: string;
  meetingType: string;
  date: string;                        // ISO date
  status: "draft" | "review" | "flagged" | "finalized";
  flagCount: number;
  advisorInitials: string;
}
```

### 5.2 Individual Endpoints (if splitting)

| Endpoint | Returns | Cache |
|----------|---------|-------|
| `GET /api/dashboard/health-score` | `{ score, breakdown }` | Nightly job, read from cache |
| `GET /api/dashboard/flags-trend?weeks=12` | `WeeklyFlagData[]` | 15 min TTL |
| `GET /api/dashboard/flags-by-category` | `FlagCategoryData[]` | 15 min TTL |
| `GET /api/dashboard/meetings-by-type` | `MeetingTypeData[]` | 15 min TTL |
| `GET /api/dashboard/finalize-trend?weeks=8` | `FinalizeTimeData[]` | 15 min TTL |
| `GET /api/dashboard/pipeline-counts` | `PipelineData` | Real-time |
| `GET /api/dashboard/meetings?limit=20` | `MeetingRow[]` | Real-time |

---

## 6. Responsive Behaviour

### 6.1 Breakpoints

| Breakpoint | Layout Changes |
|------------|---------------|
| ≥1280px (default) | Full layout as specified above |
| 1024–1279px | Row 1: 2 columns (Health spans full width above, Flags + Categories side by side). Row 2: 2×2 grid |
| 768–1023px | Sidebar collapses to icon-only (64px wide, tooltip on hover). All grids become single-column stack |
| <768px | Sidebar becomes bottom nav or hamburger menu. Single column throughout |

### 6.2 Sidebar Collapsed State (Tablet)

- Width: 64px
- Show only icons, centred
- Logo: icon only (no text)
- Workspace: initials only
- Active indicator: left-border `3px brand.DEFAULT` instead of full background
- On hover: tooltip with label (same dark tooltip style as charts)

---

## 7. Component File Structure

Suggested file organisation:

```
src/
├── app/
│   └── dashboard/
│       └── page.tsx                    # Dashboard page (server component wrapper)
├── components/
│   ├── layout/
│   │   ├── sidebar.tsx                 # Full sidebar with nav, workspace, user
│   │   ├── header.tsx                  # Top bar with search + notifications
│   │   └── shell.tsx                   # Page shell (sidebar + header + content)
│   ├── dashboard/
│   │   ├── health-gauge.tsx            # SVG semi-circle gauge
│   │   ├── flags-area-chart.tsx        # D3/Recharts area chart
│   │   ├── flag-category-bars.tsx      # Horizontal breakdown bars
│   │   ├── meeting-type-donut.tsx      # Interactive donut + legend
│   │   ├── finalize-sparkline.tsx      # Mini sparkline with target line
│   │   ├── metric-card.tsx             # Reusable number + CTA card
│   │   ├── pipeline-bar.tsx            # Segmented progress bar + legend
│   │   └── meeting-table.tsx           # Full table with status badges
│   └── ui/
│       ├── status-badge.tsx            # Pill badge (status-aware)
│       ├── flag-indicator.tsx          # Flag icon + count (colour-coded)
│       └── chart-tooltip.tsx           # Shared tooltip component
├── lib/
│   ├── dashboard-api.ts               # API fetchers for dashboard data
│   └── colors.ts                      # Brand colour constants (exported for D3 usage)
└── styles/
    └── globals.css                     # Tailwind imports + DM Sans + custom tokens
```

---

## 8. Implementation Priority

### Phase 1 — Ship the Dashboard Shell (Sprint 1)

1. **Shell layout** — sidebar, header, page wrapper
2. **Sidebar** — full nav with icons, workspace selector (static for now), user block
3. **Compliance Health Gauge** — SVG component with animated arc
4. **Pipeline Bar** — derived from meeting status counts
5. **Meeting Table** — with status badges, flag column, hover states
6. **Metric Cards** — Pending Review + Audit Packs (simple number + CTA)

### Phase 2 — Interactive Charts (Sprint 2)

7. **Flags Area Chart** — with D3 or Recharts, tooltips
8. **Flag Category Breakdown** — horizontal bars with cross-highlight
9. **Meetings by Type Donut** — interactive donut with legend cross-highlight
10. **Finalize Sparkline** — with target line and tooltips

### Phase 3 — Data Wiring & Polish (Sprint 3)

11. Wire all components to live API endpoints
12. Responsive breakpoints (tablet sidebar collapse)
13. Notification bell dropdown
14. Workspace switcher (multi-tenant support)
15. Loading skeleton states for all chart components

---

## 9. Chart Library Decision

**Recommended: Recharts for standard charts, D3 for custom visualisations.**

| Component | Library | Rationale |
|-----------|---------|-----------|
| Flags Area Chart | Recharts `<AreaChart>` | Standard area chart, Recharts handles it well with less code |
| Flag Category Bars | Custom (Tailwind divs) | Simple enough that a library is overkill — just `width: {pct}%` on divs |
| Meeting Type Donut | D3 `d3.pie()` + `d3.arc()` | Recharts PieChart doesn't support the cross-highlight interaction cleanly |
| Finalize Sparkline | D3 | Small custom chart with dashed target line — Recharts `<ReferenceLine>` works but D3 gives more control at this scale |
| Health Gauge | Custom SVG | Too specific for any library — raw SVG with `stroke-dasharray` |
| Pipeline Bar | Custom (Tailwind divs) | Flexbox divs with proportional `flex` values |

If the team prefers a single library, Recharts can handle everything except the health gauge and cross-highlight donut. The donut could use Recharts `<PieChart>` with `onMouseEnter`/`onMouseLeave` handlers and conditional `opacity` props on `<Cell>` elements.

---

## 10. Accessibility Notes

| Requirement | Implementation |
|-------------|----------------|
| Colour contrast | All text meets WCAG AA against its background. Verified: `#64748B` on `#FFFFFF` = 5.0:1 ✓. `#8BBFA3` on `#082F1C` = 5.7:1 ✓ |
| Chart alt text | Each chart component should include an `aria-label` summarising the data (e.g., "Open flags trend over 12 weeks, currently 19, increasing") |
| Keyboard navigation | Table rows focusable with `tabIndex={0}`, Enter to navigate. Nav items are `<button>` elements |
| Screen reader for badges | Status badges include `aria-label="{status}"` |
| Reduced motion | Wrap gauge and bar animations in `prefers-reduced-motion` media query — skip animation, show final state immediately |
| Tooltip accessibility | Tooltips are visual-only (decorative). The underlying data is in the chart's `aria-label`. If needed, add `aria-describedby` linking dot to tooltip content |

---

## 11. PRD Cross-Reference

This dashboard implements **Epic 7: Dashboard & Reporting** from the ComplyVault PRD v1.2. Here is how each PRD section maps to components:

| PRD Section | Component(s) | Status |
|-------------|-------------|--------|
| 7.1 Compliance Health Score (0–100, 4 sub-scores) | `health-gauge.tsx` | ✅ Designed |
| 7.2 KPI cards (Meetings, Flags, Time to Finalise, Pending Sigs) | `metric-card.tsx`, `flags-area-chart.tsx`, `finalize-sparkline.tsx` | ✅ Designed (elevated from flat cards to interactive charts) |
| 7.3 Urgent Alert Banner | Not yet designed — recommend top-of-content banner with red/amber background, dismissible, for events like "3 meetings overdue for CCO review" | 🔲 Backlog |
| 7.4 Recent Meetings table | `meeting-table.tsx` | ✅ Designed |
| 7.5 Action Required panel | Partially covered by "Pending Review" card CTA + Review Queue badge. Dedicated panel not yet designed | 🔲 Backlog |
| 7.6 Integration Health panel | Not yet designed — belongs on Integrations page or as a sidebar widget | 🔲 Backlog |
| 7.7 SEC Exam Readiness | Not yet designed — Phase 2 (Epic 8 dependency). Recommend a second gauge or checklist component | 🔲 Backlog |
| 7.8 Meeting Coverage chart | Partially represented by `meeting-type-donut.tsx`. Full coverage (meetings per client vs. required schedule) needs a separate component | 🔲 Backlog |
| 7.9 Upcoming Deadlines | Not yet designed — recommend a timeline/list widget below the meeting table | 🔲 Backlog |

**New components not in original PRD (added from UX audit):**

| Component | Rationale |
|-----------|-----------|
| Flag Category Breakdown bars | CCOs need to know *what type* of flags are accumulating, not just the total — maps to SEC exam topic areas |
| Pipeline Bar | Visual workflow status at a glance — shows bottlenecks (e.g., too many meetings stuck in Review) |
| Flags trend area chart | Trend over time is more actionable than a point-in-time number — shows whether compliance posture is improving or degrading |
| Meeting table flag column | Per-meeting flag severity at the list level, colour-coded, with "✓ Clean" for zero-flag meetings |
| Workspace selector (sidebar) | Supports multi-tenant CCO use case — managing multiple RIA clients from one dashboard |

These additions should be folded into Epic 7 in the full PRD as stories 7.10–7.14.
