import { describe, it, expect } from "vitest";
import { chartBounds, projectPoint } from "../chart";

describe("chartBounds", () => {
  it("returns at least 1 for empty input", () => {
    expect(chartBounds([])).toEqual({ xMax: 1, yMax: 1 });
  });

  it("uses the longest series for xMax and the largest value for yMax", () => {
    const b = chartBounds([
      [0, 2, 5],
      [0, 3],
    ]);
    expect(b.xMax).toBe(2); // longest series has 3 points → max step index 2
    expect(b.yMax).toBe(5);
  });
});

describe("projectPoint", () => {
  const bounds = { xMax: 10, yMax: 20 };

  it("maps the origin to the bottom-left inside padding", () => {
    const p = projectPoint(0, 0, bounds, 100, 100, 10);
    expect(p.x).toBeCloseTo(10, 5);
    expect(p.y).toBeCloseTo(90, 5); // height - pad
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
