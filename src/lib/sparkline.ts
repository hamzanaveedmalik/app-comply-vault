export type SparklinePoint = { x: number; y: number };

export type Sparkline = {
  line: string;
  area: string;
  last: SparklinePoint;
};

/**
 * Build SVG path strings for a sparkline from a series of numeric values.
 * Higher values render nearer the top of the box.
 */
export function buildSparkline(
  values: number[],
  opts: { width: number; height: number; pad?: number },
): Sparkline {
  const { width, height } = opts;
  const pad = opts.pad ?? 2;
  const n = values.length;
  if (n === 0) {
    return { line: "", area: "", last: { x: 0, y: height } };
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const stepX = n === 1 ? 0 : width / (n - 1);

  const points: SparklinePoint[] = values.map((v, i) => {
    const x = n === 1 ? width / 2 : i * stepX;
    const y = pad + (height - 2 * pad) * (1 - (v - min) / range);
    return { x: Number(x.toFixed(2)), y: Number(y.toFixed(2)) };
  });

  const line = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`)
    .join(" ");
  const first = points[0]!;
  const lastPoint = points[n - 1]!;
  const area = `${line} L${lastPoint.x},${height} L${first.x},${height} Z`;

  return { line, area, last: lastPoint };
}
