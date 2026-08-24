export type ChartFilterParam = {
  /** Destination path, e.g. /review */
  href: string;
  /** Query parameters applied on click-through */
  params: Record<string, string>;
};

export type ChartDataRow = {
  /** Row label (period, category, etc.) */
  label: string;
  /** Series key → numeric value */
  values: Record<string, number>;
  /** Optional per-row filter override */
  filter?: ChartFilterParam;
  /** Underlying record IDs for evidence export */
  recordIds?: string[];
};

export type ChartSeriesConfig = {
  key: string;
  label: string;
  color: string;
  filter: ChartFilterParam;
};

export function buildFilterHref(filter: ChartFilterParam): string {
  const params = new URLSearchParams(filter.params);
  const qs = params.toString();
  return qs ? `${filter.href}?${qs}` : filter.href;
}

export function countRecords(rows: ChartDataRow[], seriesKey?: string): number {
  if (seriesKey) {
    return rows.reduce((sum, row) => sum + (row.values[seriesKey] ?? 0), 0);
  }
  return rows.reduce(
    (sum, row) => sum + Object.values(row.values).reduce((a, b) => a + b, 0),
    0,
  );
}
