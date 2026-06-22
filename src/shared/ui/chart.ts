export interface RewardRun {
  id: number;
  label: string;
  color: string;
  /** cumulative[k] = total reward after k steps; cumulative[0] = 0. */
  cumulative: number[];
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

/** Largest step index and cumulative value across all series (min 1 to avoid /0). */
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
