// src/shared/rl/__tests__/td-estimators.test.ts
import { describe, it, expect } from "vitest";
import {
  computeValues,
  rmsError,
  type EvalParams,
  type Transition,
} from "@/shared/rl/td-estimators";

// One episode of the [start, road, restaurant] corridor, deterministic rewards:
// enter road: -2, enter restaurant: +10. gamma=1.
const EPISODE: Transition[] = [
  { state: 0, reward: -2, nextState: 1, done: false },
  { state: 1, reward: 10, nextState: 2, done: true },
];

function params(over: Partial<EvalParams>): EvalParams {
  return { method: "td0", alpha: 1, gamma: 1, n: 1, numStates: 3, ...over };
}

describe("TD(0)", () => {
  it("bootstraps; needs two passes to propagate value back (alpha=1)", () => {
    const after1 = computeValues(EPISODE, params({ method: "td0" }));
    expect(after1).toEqual([-2, 10, 0]); // V[0] used V[1]=0
    const after2 = computeValues([...EPISODE, ...EPISODE], params({ method: "td0" }));
    expect(after2[0]).toBeCloseTo(8); // now V[1]=10 had propagated
    expect(after2[1]).toBeCloseTo(10);
  });
});

describe("Monte Carlo", () => {
  it("assigns the full return at episode end (alpha=1, one episode)", () => {
    const V = computeValues(EPISODE, params({ method: "mc" }));
    expect(V[0]).toBeCloseTo(8); // G = -2 + 10
    expect(V[1]).toBeCloseTo(10);
  });
  it("applies no update for an incomplete episode (delayed)", () => {
    const partial: Transition[] = [{ state: 0, reward: -2, nextState: 1, done: false }];
    expect(computeValues(partial, params({ method: "mc" }))).toEqual([0, 0, 0]);
  });
});

describe("rmsError", () => {
  it("is the RMS over the given states only", () => {
    expect(rmsError([8, 10, 0], [9, 10, 0], [0, 1])).toBeCloseTo(Math.sqrt((1 + 0) / 2));
  });
  it("is 0 for no states", () => {
    expect(rmsError([1, 2], [3, 4], [])).toBe(0);
  });
});
