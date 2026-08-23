/**
 * Pure helpers for Priority Inbox virtual row math (beUI table pattern, read-only).
 */

export const PRIORITY_INBOX_ROW_HEIGHT = 132;
export const PRIORITY_INBOX_OVERSCAN = 8;

export function visibleRowRange(
  total: number,
  scrollOffset: number,
  rowHeight: number,
  containerHeight: number,
  overscan: number,
): { start: number; end: number } {
  if (total <= 0) {
    return { start: 0, end: 0 };
  }
  const start = Math.max(0, Math.floor(scrollOffset / rowHeight) - overscan);
  const visibleCount = Math.ceil(containerHeight / rowHeight);
  const end = Math.min(total, start + visibleCount + overscan * 2);
  return { start, end };
}

export function countRenderedRows(
  total: number,
  scrollOffset: number,
  rowHeight: number,
  containerHeight: number,
  overscan: number,
): number {
  const { start, end } = visibleRowRange(
    total,
    scrollOffset,
    rowHeight,
    containerHeight,
    overscan,
  );
  return end - start;
}
