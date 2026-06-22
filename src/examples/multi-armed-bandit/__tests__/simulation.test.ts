import { describe, it, expect } from "vitest";
import {
  createSim,
  derive,
  stepForward,
  stepBack,
  reset,
  cumulativeReward,
  type SimConfig,
  type Restaurant,
} from "../simulation";

const restaurants: Restaurant[] = [
  { name: "A", dist: [0.1, 0.3, 0.6] },
  { name: "B", dist: [0.2, 0.4, 0.4] },
  { name: "C", dist: [0.5, 0.3, 0.2] },
];

const cfg = (over: Partial<SimConfig> = {}): SimConfig => ({
  restaurants,
  policy: "random",
  epsilon: 0.1,
  optimisticInit: 4,
  seed: 12345,
  ...over,
});

describe("simulation", () => {
  it("starts empty", () => {
    const d = derive(createSim(cfg()));
    expect(d.step).toBe(0);
    expect(d.counts).toEqual([0, 0, 0]);
    expect(d.q).toEqual([0, 0, 0]);
  });

  it("optimistic init sets starting q to the init value", () => {
    const d = derive(createSim(cfg({ policy: "optimistic" })));
    expect(d.q).toEqual([4, 4, 4]);
  });

  it("stepForward advances the pointer and records a step", () => {
    const { state, record } = stepForward(createSim(cfg()));
    expect(derive(state).step).toBe(1);
    expect([0, 1, 2]).toContain(record.arm);
    expect([1, 2, 3]).toContain(record.reward);
    expect(derive(state).counts[record.arm]).toBe(1);
  });

  it("is deterministic for the same seed", () => {
    let a = createSim(cfg());
    let b = createSim(cfg());
    for (let i = 0; i < 20; i++) {
      a = stepForward(a).state;
      b = stepForward(b).state;
    }
    expect(a.trajectory).toEqual(b.trajectory);
  });

  it("stepBack then stepForward replays the same record (no rng change)", () => {
    let s = createSim(cfg());
    for (let i = 0; i < 5; i++) s = stepForward(s).state;
    const before = s.trajectory.slice();
    s = stepBack(s);
    expect(derive(s).step).toBe(4);
    const { state, record } = stepForward(s);
    expect(record).toEqual(before[4]);
    expect(state.trajectory).toEqual(before);
  });

  it("continues generating new records after rewinding to the tip", () => {
    let s = createSim(cfg());
    for (let i = 0; i < 3; i++) s = stepForward(s).state;
    s = stepBack(s);
    s = stepForward(s).state; // replays index 2
    const { state } = stepForward(s); // genuinely new at tip
    expect(state.trajectory.length).toBe(4);
    expect(derive(state).step).toBe(4);
  });

  it("stepBack at zero is a no-op", () => {
    const s = createSim(cfg());
    expect(stepBack(s)).toBe(s);
  });

  it("reset clears the trajectory and reuses the seed by default", () => {
    let s = createSim(cfg());
    for (let i = 0; i < 5; i++) s = stepForward(s).state;
    const r = reset(s);
    expect(derive(r).step).toBe(0);
    expect(r.trajectory).toEqual([]);
    // same seed → same first step as a fresh sim
    const fresh = stepForward(createSim(cfg())).state;
    expect(stepForward(r).state.trajectory[0]).toEqual(fresh.trajectory[0]);
  });

  it("records a selection reason on each step", () => {
    expect(stepForward(createSim(cfg({ policy: "greedy" }))).record.reason).toBe("exploit");
    expect(stepForward(createSim(cfg({ policy: "random" }))).record.reason).toBe("explore");
  });

  it("cumulativeReward starts at [0] and accumulates each step's reward", () => {
    let s = createSim(cfg());
    expect(cumulativeReward(s)).toEqual([0]);
    for (let i = 0; i < 4; i++) s = stepForward(s).state;
    const cum = cumulativeReward(s);
    expect(cum).toHaveLength(5); // [0, ...4 steps]
    expect(cum[0]).toBe(0);
    for (let i = 1; i < cum.length; i++) {
      expect(cum[i] - cum[i - 1]).toBe(s.trajectory[i - 1].reward);
    }
    expect(cum[cum.length - 1]).toBe(s.trajectory.reduce((a, r) => a + r.reward, 0));
  });

  it("cumulativeReward follows the pointer (rewind shortens it)", () => {
    let s = createSim(cfg());
    for (let i = 0; i < 4; i++) s = stepForward(s).state;
    s = stepBack(s);
    expect(cumulativeReward(s)).toHaveLength(4); // [0, ...3 steps]
  });
});
