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

describe("n-step TD", () => {
  const EP: Transition[] = [
    { state: 0, reward: -2, nextState: 1, done: false },
    { state: 1, reward: 10, nextState: 2, done: true },
  ];
  const two = [...EP, ...EP];

  it("n=1 is identical to TD(0)", () => {
    const a = computeValues(two, { method: "nstep", alpha: 1, gamma: 1, n: 1, numStates: 3 });
    const b = computeValues(two, { method: "td0", alpha: 1, gamma: 1, n: 1, numStates: 3 });
    expect(a).toEqual(b);
  });

  it("large n equals Monte Carlo within one episode", () => {
    const a = computeValues(EP, { method: "nstep", alpha: 1, gamma: 1, n: 10, numStates: 3 });
    const b = computeValues(EP, { method: "mc", alpha: 1, gamma: 1, n: 10, numStates: 3 });
    expect(a).toEqual(b);
  });

  it("a 2-step return on a 3-state episode matches a hand computation", () => {
    // Episode: s0 -(r=1)-> s1 -(r=1)-> s2 -(r=10,done)-> term. gamma=1, alpha=1, n=2.
    const ep: Transition[] = [
      { state: 0, reward: 1, nextState: 1, done: false },
      { state: 1, reward: 1, nextState: 2, done: false },
      { state: 2, reward: 10, nextState: 3, done: true },
    ];
    const V = computeValues(ep, { method: "nstep", alpha: 1, gamma: 1, n: 2, numStates: 4 });
    // tau=0 closes at 2nd reward: G = 1 + 1 + V[2]; V[2] updated first in same pass?
    // Online order: V[2] is updated at episode end (flush) BEFORE? No — tau=0 closes
    // when the 2nd transition arrives, bootstrapping on V[s2]=0 at that time:
    // V[0] = 1 + 1 + 0 = 2. Then flush: V[1] = 1 + 10 = 11; V[2] = 10.
    expect(V[0]).toBeCloseTo(2);
    expect(V[1]).toBeCloseTo(11);
    expect(V[2]).toBeCloseTo(10);
  });

  it("applies only closed windows for an incomplete episode", () => {
    const partial: Transition[] = [
      { state: 0, reward: 1, nextState: 1, done: false },
      { state: 1, reward: 1, nextState: 2, done: false },
    ];
    // n=3: no window closes, no episode end -> no updates yet.
    expect(computeValues(partial, { method: "nstep", alpha: 1, gamma: 1, n: 3, numStates: 3 }))
      .toEqual([0, 0, 0]);
  });
});
