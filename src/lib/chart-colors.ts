/** Semantic chart colours — mirrors CSS tokens in globals.css for Recharts/SVG. */
export const chartColors = {
  cleared: "var(--chart-cleared)",
  sampled: "var(--chart-sampled)",
  priority: "var(--chart-priority)",
  held: "var(--chart-held)",
  remediation: "var(--chart-remediation)",
  breach: "var(--chart-breach)",
  opened: "var(--chart-opened)",
  resolved: "var(--chart-resolved)",
} as const;

export type ChartSemanticKey = keyof typeof chartColors;
