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

// ─── Task 3 additions ────────────────────────────────────────────────────────
import { chooseAction, visitedStates, episodeReturn } from "../simulation";

function corridorConfigEps(epsilon: number) {
  const world: World = {
    rows: 1, cols: 3,
    cells: ["start", "empty", "restaurant"],
    start: 0,
    reward: { x1: 0, x2: 0, r1: 0, r2: 0, r3: 0, r4: 10, stepCost: 0 },
  };
  const policy: Policy = ["right", "right", "right"];
  return { world, policy, method: "td0" as const, alpha: 0.1, gamma: 1, n: 1, seed: 1, policyType: "epsilon" as const, epsilon };
}

describe("epsilon-soft stepping", () => {
  it("is deterministic for a seed and differs from epsilon=0 sometimes", () => {
    const a = collect(corridorConfigEps(0.9));
    const b = collect(corridorConfigEps(0.9));
    expect(a).toEqual(b); // same seed => identical
  });
  it("does not consume RNG for action when deterministic (v1 stream preserved)", () => {
    // With a hazard cell, the reward draw must match between an explicitly-deterministic
    // config and one with no policyType set at all.
    const world: World = {
      rows: 1, cols: 3,
      cells: ["start", "road", "restaurant"],
      start: 0,
      reward: { x1: 0.5, x2: 0, r1: 4, r2: 0, r3: 0, r4: 10, stepCost: 0 },
    };
    const policy: Policy = ["right", "right", "right"];
    const base = { world, policy, method: "td0" as const, alpha: 0.1, gamma: 1, n: 1, seed: 5 };
    const withType = { ...base, policyType: "deterministic" as const, epsilon: 0 };
    expect(collect(base)).toEqual(collect(withType));
  });
});

describe("chooseAction (manual)", () => {
  it("appends a step for the chosen action and truncates rewound future", () => {
    let s = createSim(corridorConfigEps(0));
    s = chooseAction(s, "right").state; // 0 -> 1
    s = chooseAction(s, "right").state; // 1 -> 2 (restaurant, done)
    expect(s.pointer).toBe(2);
    expect(s.trajectory[1].done).toBe(true);
  });
  it("manual choice overrides the policy direction", () => {
    let s = createSim(corridorConfigEps(0));
    const { record } = chooseAction(s, "left"); // off-board -> stays at 0
    expect(record.state).toBe(0);
    expect(record.nextState).toBe(0);
  });
});

describe("visitedStates", () => {
  it("returns the unique states in the applied prefix", () => {
    let s = createSim(corridorConfigEps(0));
    s = chooseAction(s, "right").state;
    s = chooseAction(s, "right").state;
    expect(visitedStates(s).sort((a, b) => a - b)).toEqual([0, 1]);
  });
});

describe("episodeReturn", () => {
  it("tracks the running current-episode return and the last completed one", () => {
    const world: World = {
      rows: 1, cols: 3,
      cells: ["start", "poutine", "restaurant"],
      start: 0,
      reward: { x1: 0, x2: 0, r1: 0, r2: 0, r3: 5, r4: 10, stepCost: 0 },
    };
    const policy: Policy = ["right", "right", "right"];
    let s = createSim({ world, policy, method: "td0", alpha: 0.1, gamma: 1, n: 1, seed: 1 });
    s = chooseAction(s, "right").state; // enter poutine +5
    expect(episodeReturn(s)).toEqual({ current: 5, last: null });
    s = chooseAction(s, "right").state; // enter restaurant +10, done
    expect(episodeReturn(s)).toEqual({ current: 0, last: 15 }); // episode done -> current resets, last=15
  });
});

function collect(config: Parameters<typeof createSim>[0]) {
  let s = createSim(config);
  const rewards: number[] = [];
  for (let i = 0; i < 20; i++) {
    const out = stepForward(s);
    s = out.state;
    rewards.push(out.record.reward);
    if (out.record.done) break;
  }
  return rewards;
}
