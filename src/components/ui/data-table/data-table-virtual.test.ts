import { describe, expect, it } from "vitest";
import { countRenderedRows } from "~/components/supervision/priority-inbox-virtual";

/** beUI DataTable default row height used on interaction-log / audit-logs. */
const DATA_TABLE_ROW_HEIGHT = 52;
const DATA_TABLE_HEIGHT = 560;
const DATA_TABLE_OVERSCAN = 8;

describe("data-table virtualization", () => {
  it("renders far fewer than 500 DOM rows at default viewport", () => {
    const rendered = countRenderedRows(
      500,
      0,
      DATA_TABLE_ROW_HEIGHT,
      DATA_TABLE_HEIGHT,
      DATA_TABLE_OVERSCAN,
    );
    expect(rendered).toBeLessThan(30);
    expect(rendered).toBeGreaterThan(0);
  });
});
