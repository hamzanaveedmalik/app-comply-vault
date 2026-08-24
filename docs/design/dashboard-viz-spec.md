# Dashboard visualization spec

Chart semantics and card priority for the ComplyVault CCO dashboard. Typography and chart infrastructure live in `.cursor/commands/dashboard-charts.md`.

## 0. Figure reconciliation

| Figure | Source of truth | Cards |
|--------|-----------------|-------|
| Open flags | `buildDashboardSummary.openFlags` | Flag Activity headline |
| Health score | `buildDashboardSummary.healthScore` | Compliance Health ring |
| Supervision counts | `getSupervisionSummary.counts` | Supervision selectivity strip |
| Audit readiness | `buildDashboardSummary.auditReadiness` | Audit Readiness fraction |

All cards read from server summaries on `/dashboard`; no client-side recomputation.

## 1. Supervision selectivity

Six metrics: processed, cleared/deprioritised, routine samples, priority findings, held, open remediation. Click-through to `/interaction-log` with outcome filters.

## 2. Compliance Health

ProgressCircle 0–100 with status label. BarList ranks points lost by factor (100 − sub-score). Sparkline shows range trend. Link to compliance cockpit.

## 3. Flag Activity

ChartFrame + grouped bars (opened vs resolved). Tracker strip for weekly volume. Click-through to `/review` with status filter. Low-n (&lt;25) shows record list.

## 4. Flag Aging

Headline: average days open. Segmented bar by bucket. SLA callout.

## 5. Dispositions

BarList: resolved, dismissed, escalated for selected range. False-positive rate footer.

## 6. Time to Finalize

Headline average days vs target. Dot strip for recent finalizations; breach colour for late.

## 7. Rebuild priority

1. Supervision selectivity (typography + tabular)
2. Compliance Health (ProgressCircle + BarList)
3. Flag Activity (ChartFrame + Tracker)
4. Dispositions (BarList)
5. Flag Aging, Time to Finalize, Audit Readiness (tabular pass)
6. Clients / advisors tables
7. Meeting table

## 8. Semantic chart colours

| Token | Meaning |
|-------|---------|
| `--chart-cleared` | Cleared / resolved / healthy |
| `--chart-sampled` | Sampled / dismissed / neutral volume |
| `--chart-priority` | Priority / warning |
| `--chart-held` | Held / pending |
| `--chart-remediation` | Open remediation |
| `--chart-breach` | Escalated / SLA breach — **only red on dashboard** |
