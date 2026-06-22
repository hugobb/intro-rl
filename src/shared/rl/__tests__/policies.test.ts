import { describe, it, expect } from "vitest";
import { selectArm, argmaxRandomTie } from "../policies";
import { createRng } from "../rng";
import type { Estimates } from "../estimator";

const est = (q: number[]): Estimates => ({ q, counts: q.map(() => 0), priorCount: 0 });

describe("argmaxRandomTie", () => {
  it("returns the unique max index", () => {
    expect(argmaxRandomTie([1, 5, 2], createRng(1))).toBe(1);
  });

  it("breaks ties within the tied set", () => {
    const rng = createRng(1);
    const seen = new Set<number>();
    for (let i = 0; i < 200; i++) seen.add(argmaxRandomTie([3, 3, 1], rng));
    expect([...seen].sort()).toEqual([0, 1]);
  });
});

describe("selectArm", () => {
  it("greedy always picks the max", () => {
    const rng = createRng(1);
    for (let i = 0; i < 50; i++) {
      expect(selectArm("greedy", est([1, 9, 2]), 0, rng)).toBe(1);
    }
  });

  it("optimistic selects like greedy", () => {
    const rng = createRng(1);
    expect(selectArm("optimistic", est([1, 9, 2]), 0, rng)).toBe(1);
  });

  it("random spreads across all arms", () => {
    const rng = createRng(2);
    const seen = new Set<number>();
    for (let i = 0; i < 200; i++) seen.add(selectArm("random", est([1, 9, 2]), 0, rng));
    expect([...seen].sort()).toEqual([0, 1, 2]);
  });

  it("epsilon-greedy with epsilon=0 is greedy", () => {
    const rng = createRng(5);
    for (let i = 0; i < 50; i++) {
      expect(selectArm("epsilon-greedy", est([1, 9, 2]), 0, rng)).toBe(1);
    }
  });

  it("epsilon-greedy with epsilon=1 explores all arms", () => {
    const rng = createRng(5);
    const seen = new Set<number>();
    for (let i = 0; i < 300; i++) seen.add(selectArm("epsilon-greedy", est([1, 9, 2]), 1, rng));
    expect([...seen].sort()).toEqual([0, 1, 2]);
  });
});
