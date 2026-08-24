import { cn } from "~/lib/utils";

/** Dashboard type scale — single source for figure-heavy cards. */
export const dashboardType = {
  pageTitle: "text-[18px] font-semibold tracking-tight text-text-primary",
  pageSubtitle: "text-dashboard-caption text-text-secondary",
  cardTitle: "text-dashboard-card-title font-semibold text-text-secondary",
  cardTitleEmphasis: "text-[13.5px] font-semibold text-text-primary",
  cardLink: "text-[12px] font-semibold text-brand hover:underline",
  displayFigure: "text-dashboard-display font-semibold leading-none tracking-tight tabular text-text-primary",
  displayFigureSm: "text-dashboard-figure-sm font-semibold leading-none tabular text-text-primary",
  metricLabel: "text-dashboard-metric-label font-medium text-text-secondary",
  metricUnit: "text-dashboard-caption text-text-secondary",
  axisTick: "text-dashboard-axis tabular text-text-muted",
  caption: "text-dashboard-caption text-text-secondary",
  deltaGood: "text-[11.5px] font-semibold tabular text-brand",
  deltaBad: "text-[11.5px] font-semibold tabular text-semantic-danger",
  tableHeader: "text-dashboard-axis font-semibold text-text-muted",
  tableCell: "text-[12.5px] text-text-secondary",
  tableCellPrimary: "text-[12.5px] font-semibold text-text-primary",
  badgeCount: "text-[11px] font-semibold tabular",
} as const;

export function dashboardTypeClass(
  ...keys: Array<keyof typeof dashboardType>
): string {
  return cn(...keys.map((k) => dashboardType[k]));
}
