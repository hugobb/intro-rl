export type ChartMetric = "total-reward" | "optimal-pct";

export interface RunData {
  id: number;
  label: string;
  color: string;
  arms: number[]; // chosen arm index per applied step
  rewards: number[]; // reward per applied step (parallel to arms)
  optimalArm: number; // arm with the highest true mean at run time
}

export const CHART_METRICS: { value: ChartMetric; label: string }[] = [
  { value: "total-reward", label: "Total reward" },
  { value: "optimal-pct", label: "% optimal action" },
];

/**
 * Series indexed by step; series[0] = 0 (before any step), series[k] = the
 * metric's value after k steps.
 * - total-reward: cumulative sum of rewards.
 * - optimal-pct: running percentage of steps that chose the optimal arm.
 */
export function metricSeries(run: RunData, metric: ChartMetric): number[] {
  const out: number[] = [0];
  if (metric === "total-reward") {
    let sum = 0;
    for (const r of run.rewards) {
      sum += r;
      out.push(sum);
    }
  } else {
    let optimal = 0;
    for (let i = 0; i < run.arms.length; i++) {
      if (run.arms[i] === run.optimalArm) optimal += 1;
      out.push((100 * optimal) / (i + 1));
    }
  }
  return out;
}

/** Fixed y-axis maximum for a metric, or null to auto-scale from the data. */
export function metricYMax(metric: ChartMetric): number | null {
  return metric === "optimal-pct" ? 100 : null;
}

/** Distinct line colors for saved runs, cycled by index. */
export const RUN_COLORS: string[] = [
  "#ef7d57",
  "#38b764",
  "#41a6f6",
  "#ffcd75",
  "#b13e53",
  "#a7f070",
  "#73eff7",
  "#94b0c2",
];

export interface ChartBounds {
  xMax: number;
  yMax: number;
}

/** Largest step index and value across all series (min 1 to avoid /0). */
export function chartBounds(series: number[][]): ChartBounds {
  let xMax = 1;
  let yMax = 1;
  for (const s of series) {
    xMax = Math.max(xMax, s.length - 1);
    for (const v of s) yMax = Math.max(yMax, v);
  }
  return { xMax, yMax };
}

/** Project a (step, value) point into canvas pixel coordinates within `pad`. */
export function projectPoint(
  step: number,
  value: number,
  bounds: ChartBounds,
  width: number,
  height: number,
  pad: number,
): { x: number; y: number } {
  const x = pad + (step / bounds.xMax) * (width - 2 * pad);
  const y = height - pad - (value / bounds.yMax) * (height - 2 * pad);
  return { x, y };
}
