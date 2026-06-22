import { describe, it, expect } from "vitest";
import { computeLayout, characterX } from "../scene";

describe("scene layout", () => {
  it("spreads stores across the usable width in order", () => {
    const l = computeLayout(1000, 400, 3);
    expect(l.storeXs).toHaveLength(3);
    expect(l.storeXs[0]).toBeLessThan(l.storeXs[1]);
    expect(l.storeXs[1]).toBeLessThan(l.storeXs[2]);
    // character's default position is to the left of all storefronts
    expect(l.homeX).toBeLessThan(l.storeXs[0]);
  });
});

describe("characterX", () => {
  const l = computeLayout(1000, 400, 3);

  it("is at home when idle", () => {
    expect(characterX(l, "idle", 0, 0)).toBeCloseTo(l.homeX, 5);
  });

  it("interpolates home→store while walking-to", () => {
    expect(characterX(l, "walking-to", 0, 2)).toBeCloseTo(l.homeX, 5);
    expect(characterX(l, "walking-to", 1, 2)).toBeCloseTo(l.storeXs[2], 5);
    const mid = characterX(l, "walking-to", 0.5, 2);
    expect(mid).toBeCloseTo((l.homeX + l.storeXs[2]) / 2, 5);
  });

  it("holds at the store while rating", () => {
    expect(characterX(l, "rating", 0.3, 1)).toBeCloseTo(l.storeXs[1], 5);
  });

  it("interpolates store→home while walking-back", () => {
    expect(characterX(l, "walking-back", 0, 0)).toBeCloseTo(l.storeXs[0], 5);
    expect(characterX(l, "walking-back", 1, 0)).toBeCloseTo(l.homeX, 5);
  });

  it("clamps progress to [0,1]", () => {
    expect(characterX(l, "walking-to", 2, 2)).toBeCloseTo(l.storeXs[2], 5);
    expect(characterX(l, "walking-to", -1, 2)).toBeCloseTo(l.homeX, 5);
  });
});
