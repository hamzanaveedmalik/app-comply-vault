import { describe, expect, it } from "vitest";
import {
  countRenderedRows,
  PRIORITY_INBOX_OVERSCAN,
  PRIORITY_INBOX_ROW_HEIGHT,
} from "./priority-inbox-virtual";

describe("priority inbox virtualization", () => {
  it("renders far fewer than 500 DOM rows at 640px viewport", () => {
    const total = 500;
    const containerHeight = 640;
    const rendered = countRenderedRows(
      total,
      0,
      PRIORITY_INBOX_ROW_HEIGHT,
      containerHeight,
      PRIORITY_INBOX_OVERSCAN,
    );
    expect(rendered).toBeLessThan(30);
    expect(rendered).toBeGreaterThan(0);
  });

  it("caps rendered rows when scrolled near the end", () => {
    const total = 500;
    const containerHeight = 640;
    const scrollOffset = (total - 1) * PRIORITY_INBOX_ROW_HEIGHT;
    const rendered = countRenderedRows(
      total,
      scrollOffset,
      PRIORITY_INBOX_ROW_HEIGHT,
      containerHeight,
      PRIORITY_INBOX_OVERSCAN,
    );
    expect(rendered).toBeLessThan(30);
  });
});
