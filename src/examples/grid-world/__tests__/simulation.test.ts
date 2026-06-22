import { describe, it, expect } from "vitest";
import { solveV, reachableStates, type World, type Policy } from "@/shared/rl/gridworld";
import {
  createSim,
  stepForward,
  stepBack,
  runEpisode,
  derive,
  errorSeries,
  currentCell,
  type SimConfig,
} from "../simulation";

function corridorConfig(): SimConfig {
  const world: World = {
    rows: 1,
    cols: 3,
    cells: ["start", "road", "restaurant"],
    start: 0,
    reward: { x1: 0.5, x2: 0, r1: 4, r2: 0, r3: 0, r4: 10, stepCost: 0 },
  };
  const policy: Policy = ["right", "right", "right"];
  return { world, policy, method: "td0", alpha: 0.1, gamma: 1, n: 1, seed: 42 };
}

describe("stepForward", () => {
  it("is deterministic for a given seed", () => {
    const a = runFully(createSim(corridorConfig()));
    const b = runFully(createSim(corridorConfig()));
    expect(a.map((r) => r.reward)).toEqual(b.map((r) => r.reward));
  });

  it("replays recorded steps after a rewind without advancing the RNG", () => {
    let s = createSim(corridorConfig());
    s = stepForward(s).state;
    const firstRecord = s.trajectory[0];
    s = stepBack(s);
    const { record } = stepForward(s);
    expect(record).toEqual(firstRecord);
  });
});

describe("runEpisode", () => {
  it("advances until a terminal step is applied", () => {
    const s = runEpisode(createSim(corridorConfig()));
    expect(s.trajectory[s.pointer - 1].done).toBe(true);
    expect(currentCell(s)).toBe(corridorConfig().world.start); // back to start after done
  });
});

describe("derive", () => {
  it("counts completed episodes and reports the current cell", () => {
    let s = createSim(corridorConfig());
    s = runEpisode(s);
    const d = derive(s);
    expect(d.episode).toBe(1);
    expect(d.step).toBe(s.pointer);
  });
});

describe("errorSeries", () => {
  it("has one entry per completed episode plus the initial point", () => {
    let s = createSim(corridorConfig());
    s = runEpisode(s);
    s = runEpisode(s);
    const vTrue = solveV(s.config.world, s.config.policy, s.config.gamma);
    const states = reachableStates(s.config.world, s.config.policy);
    expect(errorSeries(s, vTrue, states)).toHaveLength(3); // initial + 2 episodes
  });
});

function runFully(s0: ReturnType<typeof createSim>) {
  let s = s0;
  for (let i = 0; i < 50; i++) {
    const out = stepForward(s);
    s = out.state;
    if (out.record.done) break;
  }
  return s.trajectory.slice(0, s.pointer);
}
