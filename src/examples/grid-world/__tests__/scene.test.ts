// src/examples/grid-world/__tests__/scene.test.ts
import { describe, it, expect } from "vitest";
import {
  computeGridLayout,
  cellRect,
  cellAtPoint,
  heatColor,
} from "../scene";

describe("computeGridLayout", () => {
  it("uses square cells that fit and centers the grid", () => {
    const l = computeGridLayout(560, 480, 6, 7);
    expect(l.cell).toBe(80); // min(560/7, 480/6) = 80
    expect(l.originX).toBe(0); // 7*80 = 560
    expect(l.originY).toBe(0); // 6*80 = 480
  });
});

describe("cellRect / cellAtPoint", () => {
  it("round-trips a cell's center back to its index", () => {
    const l = computeGridLayout(560, 480, 6, 7);
    for (const index of [0, 6, 7, 41]) {
      const r = cellRect(l, index);
      const hit = cellAtPoint(l, r.x + r.w / 2, r.y + r.h / 2);
      expect(hit).toBe(index);
    }
  });
  it("returns null outside the grid", () => {
    const l = computeGridLayout(560, 480, 6, 7);
    expect(cellAtPoint(l, -5, -5)).toBeNull();
    expect(cellAtPoint(l, 1000, 1000)).toBeNull();
  });
});

describe("heatColor", () => {
  it("returns a CSS color string and is neutral at 0", () => {
    expect(typeof heatColor(0, 10)).toBe("string");
    expect(heatColor(0, 10)).toBe(heatColor(0, 5));
  });
  it("handles maxAbs of 0 without NaN", () => {
    expect(heatColor(0, 0)).toMatch(/^#|rgb/);
  });
});

import { cellQuadrant } from "../scene";

describe("cellQuadrant", () => {
  it("returns the action's triangle (two cell corners + center)", () => {
    const l = computeGridLayout(560, 480, 6, 7); // cell=80, origin 0,0
    // cell 0 is at (0,0)-(80,80), center (40,40)
    expect(cellQuadrant(l, 0, "up")).toEqual([
      { x: 0, y: 0 },
      { x: 80, y: 0 },
      { x: 40, y: 40 },
    ]);
    expect(cellQuadrant(l, 0, "down")).toEqual([
      { x: 80, y: 80 },
      { x: 0, y: 80 },
      { x: 40, y: 40 },
    ]);
    expect(cellQuadrant(l, 0, "left")).toEqual([
      { x: 0, y: 80 },
      { x: 0, y: 0 },
      { x: 40, y: 40 },
    ]);
    expect(cellQuadrant(l, 0, "right")).toEqual([
      { x: 80, y: 0 },
      { x: 80, y: 80 },
      { x: 40, y: 40 },
    ]);
  });
});
