import { describe, it, expect } from "vitest";
import {
  chartBounds,
  metricSeries,
  metricYMax,
  projectPoint,
  type RunData,
} from "../chart";

const run: RunData = {
  id: 1,
  label: "x",
  color: "#fff",
  arms: [0, 1, 0, 0],
  rewards: [3, 1, 2, 3],
  optimalArm: 0,
};

describe("metricSeries", () => {
  it("total-reward is the cumulative sum starting at 0", () => {
    expect(metricSeries(run, "total-reward")).toEqual([0, 3, 4, 6, 9]);
  });

  it("optimal-pct is the running percentage of optimal-arm picks", () => {
    // arms 0,1,0,0 vs optimal 0 → after each step: 100, 50, 66.67, 75
    const s = metricSeries(run, "optimal-pct");
    expect(s[0]).toBe(0);
    expect(s[1]).toBeCloseTo(100, 5);
    expect(s[2]).toBeCloseTo(50, 5);
    expect(s[3]).toBeCloseTo(200 / 3, 5);
    expect(s[4]).toBeCloseTo(75, 5);
  });
});

describe("metricYMax", () => {
  it("is 100 for optimal-pct and null (auto) for total-reward", () => {
    expect(metricYMax("optimal-pct")).toBe(100);
    expect(metricYMax("total-reward")).toBeNull();
  });
});

describe("chartBounds", () => {
  it("returns at least 1 for empty input", () => {
    expect(chartBounds([])).toEqual({ xMax: 1, yMax: 1 });
  });

  it("uses the longest series for xMax and the largest value for yMax", () => {
    const b = chartBounds([
      [0, 2, 5],
      [0, 3],
    ]);
    expect(b.xMax).toBe(2);
    expect(b.yMax).toBe(5);
  });
});

describe("projectPoint", () => {
  const bounds = { xMax: 10, yMax: 20 };

  it("maps the origin to the bottom-left inside padding", () => {
    const p = projectPoint(0, 0, bounds, 100, 100, 10);
    expect(p.x).toBeCloseTo(10, 5);
    expect(p.y).toBeCloseTo(90, 5);
  });

  it("maps the max point to the top-right inside padding", () => {
    const p = projectPoint(10, 20, bounds, 100, 100, 10);
    expect(p.x).toBeCloseTo(90, 5);
    expect(p.y).toBeCloseTo(10, 5);
  });

  it("inverts y so larger values plot higher (smaller y)", () => {
    const low = projectPoint(0, 0, bounds, 100, 100, 10).y;
    const high = projectPoint(0, 20, bounds, 100, 100, 10).y;
    expect(high).toBeLessThan(low);
  });
});
