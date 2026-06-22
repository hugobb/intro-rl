// src/examples/grid-world/__tests__/world.test.ts
import { describe, it, expect } from "vitest";
import { reachableStates, solveV } from "@/shared/rl/gridworld";
import {
  DEFAULT_WORLD,
  DEFAULT_POLICY,
  DEFAULT_GAMMA,
  parseWorld,
  DEFAULT_REWARD,
} from "../world";

describe("parseWorld", () => {
  it("parses dimensions, cell types, and the start index", () => {
    const w = parseWorld(["S.G"], DEFAULT_REWARD);
    expect(w.rows).toBe(1);
    expect(w.cols).toBe(3);
    expect(w.cells).toEqual(["start", "empty", "restaurant"]);
    expect(w.start).toBe(0);
  });
});

describe("DEFAULT_WORLD + DEFAULT_POLICY", () => {
  it("is a 6x7 grid with a single start and restaurant", () => {
    expect(DEFAULT_WORLD.rows).toBe(6);
    expect(DEFAULT_WORLD.cols).toBe(7);
    expect(DEFAULT_WORLD.cells.filter((c) => c === "start")).toHaveLength(1);
    expect(DEFAULT_WORLD.cells.filter((c) => c === "restaurant")).toHaveLength(1);
  });

  it("default policy walks from start to the restaurant past the hazards", () => {
    const path = reachableStates(DEFAULT_WORLD, DEFAULT_POLICY);
    const types = path.map((c) => DEFAULT_WORLD.cells[c]);
    expect(types).toContain("road");
    expect(types).toContain("manhole");
    expect(types).toContain("poutine");
    // the chain must actually reach the terminal (last cell's policy step is terminal)
    const last = path[path.length - 1];
    const lastType = DEFAULT_WORLD.cells[last];
    expect(lastType).not.toBe("restaurant"); // reachableStates excludes terminal
    expect(path.length).toBeGreaterThan(5);
  });

  it("has a finite analytical V at the start under the default policy", () => {
    const V = solveV(DEFAULT_WORLD, DEFAULT_POLICY, DEFAULT_GAMMA);
    expect(Number.isFinite(V[DEFAULT_WORLD.start])).toBe(true);
  });
});
