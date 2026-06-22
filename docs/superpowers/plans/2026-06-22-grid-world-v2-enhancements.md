# Grid World v2 Enhancements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the grid-world policy-evaluation demo with cell sprites, hazard/reward animations, an episode return tracker, a model-derived Q(s,a) view, an ε-soft stochastic policy, selectable RMS chart metrics, and a manual arrow-key drive mode.

**Architecture:** Additive changes only. New pure helpers go in `src/shared/rl/gridworld.ts` (ε-aware `solveV`, `computeQ`, `allStates`). `src/examples/grid-world/simulation.ts` gains stochastic/manual stepping and tracker helpers. `scene.ts` gains a `cellQuadrant` helper and a richer (still untested) `drawScene`. New small components and the page wiring compose it together. With ε=0, Auto control mode, and the V view, behavior is identical to v1.

**Tech Stack:** Vite, React 19 + TypeScript strict, React Router, plain `<canvas>` 2D, Vitest + jsdom + @testing-library/react, Tailwind v4. pnpm.

## Global Constraints

- **TypeScript strict; no `any`; explicit exported types.**
- **`src/shared/rl/` is pure** — no React/DOM/canvas; only type-only imports from other `rl/` modules.
- **Rendering isolated** in `scene.ts` `drawScene` + `src/shared/pixel/`; pure math helpers are unit-tested, renderers are not.
- **Import alias `@/`** maps to `src/`; example-local imports use `./`.
- **Tests co-located** in `__tests__/`.
- **Additivity:** `epsilon=0` + `controlMode="policy"` + V view must reproduce v1 exactly; all existing tests must keep passing unchanged.
- **ε-soft distribution:** `π(a|s) = (1 − ε)·[a == π(s)] + ε/|A|`, with `|A| = ACTIONS.length = 4`.
- **Action order** is `ACTIONS = ["up","right","down","left"]` (exported from gridworld); Q arrays are indexed `[cell][ACTIONS index]`.
- **RNG discipline:** in deterministic mode, do NOT consume the RNG for action selection (preserves v1 trajectories/tests). Only draw from the RNG for the ε-decision when ε-soft with `epsilon > 0`.
- **Commands:** `pnpm exec vitest run <path>` (single file), `pnpm exec vitest run` (full), `pnpm typecheck`, `pnpm build`.

---

## File Structure

- `src/shared/rl/gridworld.ts` — add `epsilon` param to `solveV`; add `computeQ`, `allStates`.
- `src/examples/grid-world/world.ts` — add `DEFAULT_EPSILON`, `DEFAULT_POLICY_TYPE`, `DEFAULT_CONTROL_MODE`.
- `src/examples/grid-world/simulation.ts` — `SimConfig` optional fields (`policyType`, `epsilon`, `controlMode`); ε-soft action choice; `chooseAction`; `visitedStates`; `episodeReturn`.
- `src/examples/grid-world/scene.ts` — `cellQuadrant` (tested); `SceneState` optional fields; richer `drawScene` (sprites, Q quadrants, effects — untested).
- `src/examples/grid-world/ValueViewTabs.tsx`, `PolicyTypeTabs.tsx`, `ControlModeTabs.tsx`, `ReturnTracker.tsx` — new small components.
- `src/examples/grid-world/ConvergenceChart.tsx` — RMS metric selector.
- `src/examples/grid-world/GridWorldExample.tsx` — wire it all together.
- `README.md`, `AGENTS.md` — document v2.

---

## Task 1: ε-soft `solveV` + `allStates`

**Files:**
- Modify: `src/shared/rl/gridworld.ts`
- Test: `src/shared/rl/__tests__/gridworld.test.ts` (append)

**Interfaces:**
- Consumes: existing `World`, `Policy`, `ACTIONS`, `nextCell`, `isTerminal`, `expectedReward`.
- Produces:
  - `solveV(world, policy, gamma, epsilon = 0, tol = 1e-9, maxIters = 100000): number[]` (epsilon inserted as 4th positional arg).
  - `allStates(world: World): number[]` — non-wall, non-terminal cell indices.

- [ ] **Step 1: Write the failing tests**

```typescript
// append to src/shared/rl/__tests__/gridworld.test.ts
import { allStates } from "@/shared/rl/gridworld";

describe("solveV with epsilon (ε-soft)", () => {
  it("epsilon=0 equals the deterministic solve", () => {
    const w: World = {
      rows: 1, cols: 3,
      cells: ["start", "empty", "restaurant"],
      start: 0,
      reward: { x1: 0, x2: 0, r1: 0, r2: 0, r3: 0, r4: 10, stepCost: 0 },
    };
    const pol: Policy = ["right", "right", "right"];
    const det = solveV(w, pol, 0.9);
    const eps0 = solveV(w, pol, 0.9, 0);
    expect(eps0).toEqual(det);
  });

  it("mixes in random actions for epsilon>0", () => {
    // 1x3 [start, empty, restaurant], policy 'right'. With epsilon, state 0 sometimes
    // goes left (stays) instead of right, lowering its value below the deterministic 9.
    const w: World = {
      rows: 1, cols: 3,
      cells: ["start", "empty", "restaurant"],
      start: 0,
      reward: { x1: 0, x2: 0, r1: 0, r2: 0, r3: 0, r4: 10, stepCost: 0 },
    };
    const pol: Policy = ["right", "right", "right"];
    const det = solveV(w, pol, 0.9, 0);
    const soft = solveV(w, pol, 0.9, 0.5);
    expect(soft[0]).toBeLessThan(det[0]); // noise hurts a goal-directed policy here
    expect(soft[0]).toBeGreaterThan(0);
  });
});

describe("allStates", () => {
  it("returns non-wall, non-terminal cells", () => {
    const w: World = {
      rows: 1, cols: 4,
      cells: ["start", "wall", "empty", "restaurant"],
      start: 0,
      reward: { x1: 0, x2: 0, r1: 0, r2: 0, r3: 0, r4: 0, stepCost: 0 },
    };
    expect(allStates(w)).toEqual([0, 2]);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm exec vitest run src/shared/rl/__tests__/gridworld.test.ts`
Expected: FAIL — `allStates` not exported; `solveV` 4th arg currently `tol`.

- [ ] **Step 3: Implement**

Replace the existing `solveV` in `src/shared/rl/gridworld.ts` with the ε-aware version (note `ACTIONS` is already exported from this file), and append `allStates`:

```typescript
/**
 * Exact V(s) via iterative policy evaluation. For epsilon>0 the policy is ε-soft:
 * π(a|s) = (1-epsilon)·[a==policy[s]] + epsilon/|A|. epsilon=0 is the deterministic
 * backup (identical to before). V is 0 for walls and terminal cells.
 */
export function solveV(
  world: World,
  policy: Policy,
  gamma: number,
  epsilon = 0,
  tol = 1e-9,
  maxIters = 100000,
): number[] {
  const n = world.cells.length;
  const V = new Array<number>(n).fill(0);
  const k = ACTIONS.length;
  for (let iter = 0; iter < maxIters; iter++) {
    let delta = 0;
    for (let s = 0; s < n; s++) {
      if (world.cells[s] === "wall" || isTerminal(world, s)) continue;
      let acc = 0;
      for (const a of ACTIONS) {
        const prob = (a === policy[s] ? 1 - epsilon : 0) + epsilon / k;
        if (prob === 0) continue;
        const sp = nextCell(world, s, a);
        const backup =
          expectedReward(world, s, a) + gamma * (isTerminal(world, sp) ? 0 : V[sp]);
        acc += prob * backup;
      }
      delta = Math.max(delta, Math.abs(acc - V[s]));
      V[s] = acc;
    }
    if (delta < tol) break;
  }
  return V;
}

/** Non-wall, non-terminal cell indices (the full state space for "RMS over all"). */
export function allStates(world: World): number[] {
  const out: number[] = [];
  for (let s = 0; s < world.cells.length; s++) {
    if (world.cells[s] !== "wall" && !isTerminal(world, s)) out.push(s);
  }
  return out;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm exec vitest run src/shared/rl/__tests__/gridworld.test.ts`
Expected: PASS (new + all existing gridworld tests, since epsilon defaults to 0).

- [ ] **Step 5: Commit**

```bash
git add src/shared/rl/gridworld.ts src/shared/rl/__tests__/gridworld.test.ts
git commit -m "feat: epsilon-soft solveV and allStates for grid world"
```

---

## Task 2: `computeQ` (model-derived state-action values)

**Files:**
- Modify: `src/shared/rl/gridworld.ts`
- Test: `src/shared/rl/__tests__/gridworld.test.ts` (append)

**Interfaces:**
- Consumes: `World`, `ACTIONS`, `nextCell`, `isTerminal`, `expectedReward`.
- Produces: `computeQ(world, vEst, gamma): number[][]` — `[cell][actionIndex]`, action order = `ACTIONS`.

- [ ] **Step 1: Write the failing test**

```typescript
// append to src/shared/rl/__tests__/gridworld.test.ts
import { computeQ } from "@/shared/rl/gridworld";

describe("computeQ", () => {
  it("Q(s,a) = expectedReward(s,a) + gamma * V(next), 0 at terminal", () => {
    const w: World = {
      rows: 1, cols: 3,
      cells: ["start", "empty", "restaurant"],
      start: 0,
      reward: { x1: 0, x2: 0, r1: 0, r2: 0, r3: 0, r4: 10, stepCost: 0 },
    };
    // Pretend V is already solved: V = [9, 10, 0]
    const V = [9, 10, 0];
    const Q = computeQ(w, V, 0.9);
    // ACTIONS = ["up","right","down","left"]; from cell 1 going right enters restaurant (r4=10, terminal)
    const rightIdx = 1;
    expect(Q[1][rightIdx]).toBeCloseTo(10); // 10 + 0.9*0
    // from cell 0 going right enters cell 1 (empty, reward 0): 0 + 0.9*V[1] = 9
    expect(Q[0][rightIdx]).toBeCloseTo(9);
    // from cell 0 going left is off-board → stays at 0 (empty entry 0): 0 + 0.9*V[0] = 8.1
    const leftIdx = 3;
    expect(Q[0][leftIdx]).toBeCloseTo(8.1);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm exec vitest run src/shared/rl/__tests__/gridworld.test.ts`
Expected: FAIL — `computeQ` not exported.

- [ ] **Step 3: Implement**

Append to `src/shared/rl/gridworld.ts`:

```typescript
/**
 * Model-derived action values from an estimated (or true) V:
 * Q(s,a) = expectedReward(s,a) + gamma * (isTerminal(s') ? 0 : V[s']).
 * Indexed [cell][actionIndex] with actionIndex following ACTIONS order.
 */
export function computeQ(
  world: World,
  vEst: number[],
  gamma: number,
): number[][] {
  return world.cells.map((_, s) =>
    ACTIONS.map((a) => {
      const sp = nextCell(world, s, a);
      return (
        expectedReward(world, s, a) + gamma * (isTerminal(world, sp) ? 0 : (vEst[sp] ?? 0))
      );
    }),
  );
}
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm exec vitest run src/shared/rl/__tests__/gridworld.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/shared/rl/gridworld.ts src/shared/rl/__tests__/gridworld.test.ts
git commit -m "feat: model-derived computeQ for grid world"
```

---

## Task 3: Simulation — ε-soft stepping, manual `chooseAction`, tracker helpers

**Files:**
- Modify: `src/examples/grid-world/simulation.ts`
- Test: `src/examples/grid-world/__tests__/simulation.test.ts` (append)

**Interfaces:**
- Consumes: `ACTIONS`, `step`, `currentCell`, `MAX_EPISODE_STEPS` (existing), `RNG`.
- Produces:
  - `SimConfig` gains optional `policyType?: "deterministic" | "epsilon"`, `epsilon?: number`, `controlMode?: "policy" | "manual"`.
  - `chooseAction(state, action: Action): { state: SimState; record: StepRecord }`.
  - `visitedStates(state): number[]`.
  - `episodeReturn(state): { current: number; last: number | null }`.

- [ ] **Step 1: Write the failing tests**

```typescript
// append to src/examples/grid-world/__tests__/simulation.test.ts
// (World, Policy, createSim, stepForward are already imported at the top of this file)
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
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm exec vitest run src/examples/grid-world/__tests__/simulation.test.ts`
Expected: FAIL — `chooseAction`/`visitedStates`/`episodeReturn` not exported; `policyType`/`epsilon` not on `SimConfig`.

- [ ] **Step 3: Implement**

In `src/examples/grid-world/simulation.ts`: extend the import from gridworld to include `ACTIONS` and `Action`, add the optional config fields, the ε-soft action choice in `stepForward`'s generate branch, and the three new exports.

Change the import line:

```typescript
import { ACTIONS, step, type Action, type Policy, type World } from "@/shared/rl/gridworld";
```

Extend `SimConfig`:

```typescript
export interface SimConfig {
  world: World;
  policy: Policy;
  method: Method;
  alpha: number;
  gamma: number;
  n: number;
  seed: number;
  policyType?: "deterministic" | "epsilon";
  epsilon?: number;
  controlMode?: "policy" | "manual";
}
```

In `stepForward`, replace the action-selection line (`const action = state.config.policy[cell];`) with the ε-soft choice:

```typescript
  const cell = currentCell(state);
  let action = state.config.policy[cell];
  const epsilon = state.config.epsilon ?? 0;
  // Only consume the RNG for action selection when actually ε-soft, so deterministic
  // runs keep the exact v1 RNG stream.
  if ((state.config.policyType ?? "deterministic") === "epsilon" && epsilon > 0) {
    if (state.rng.next() < epsilon) {
      action = ACTIONS[state.rng.int(ACTIONS.length)];
    }
  }
  const res = step(state.config.world, cell, action, state.rng);
```

Append the new exports:

```typescript
/**
 * Manual control: take `action` at the current cell, sampling its reward. Discards any
 * rewound-future steps and appends the new step (loop-guard truncation applies as in
 * stepForward). Used by Manual mode (arrow keys).
 */
export function chooseAction(
  state: SimState,
  action: Action,
): { state: SimState; record: StepRecord } {
  const cell = currentCell(state);
  const res = step(state.config.world, cell, action, state.rng);
  const truncated = episodeStepCount(state) + 1 >= MAX_EPISODE_STEPS;
  const record: StepRecord = {
    state: cell,
    reward: res.reward,
    nextState: res.next,
    done: res.done || truncated,
  };
  const trajectory = state.trajectory.slice(0, state.pointer).concat(record);
  return {
    state: { ...state, trajectory, pointer: state.pointer + 1 },
    record,
  };
}

/** Unique states appearing in the applied trajectory prefix. */
export function visitedStates(state: SimState): number[] {
  const seen = new Set<number>();
  for (let i = 0; i < state.pointer; i++) seen.add(state.trajectory[i].state);
  return [...seen];
}

/**
 * Undiscounted episode "score": `current` = sum of rewards since the last completed
 * episode (the in-progress episode; 0 right after one ends); `last` = the total of the
 * previous completed episode (or null if none).
 */
export function episodeReturn(state: SimState): { current: number; last: number | null } {
  const traj = state.trajectory;
  let current = 0;
  let i = state.pointer - 1;
  while (i >= 0 && !traj[i].done) {
    current += traj[i].reward;
    i -= 1;
  }
  let last: number | null = null;
  if (i >= 0) {
    last = traj[i].reward; // the done step itself
    let j = i - 1;
    while (j >= 0 && !traj[j].done) {
      last += traj[j].reward;
      j -= 1;
    }
  }
  return { current, last };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm exec vitest run src/examples/grid-world/__tests__/simulation.test.ts`
Expected: PASS (new + existing simulation tests).

- [ ] **Step 5: Commit**

```bash
git add src/examples/grid-world/simulation.ts src/examples/grid-world/__tests__/simulation.test.ts
git commit -m "feat: epsilon-soft stepping, manual chooseAction, and tracker helpers"
```

---

## Task 4: Scene — `cellQuadrant`, sprites, Q quadrants, effects

**Files:**
- Modify: `src/examples/grid-world/scene.ts`
- Test: `src/examples/grid-world/__tests__/scene.test.ts` (append)

**Interfaces:**
- Consumes: `GridLayout`, `cellRect`, `heatColor`, `Action`, `Policy`, `World`, `PALETTE`, `PIXEL_FONT`.
- Produces:
  - `cellQuadrant(layout, cell, action): { x: number; y: number }[]` — 3 triangle points (corner, corner, center).
  - `SceneState` gains optional `valueView?: "v" | "q"`, `q?: number[][]`, `qMaxAbs?: number`, `effect?: { kind: "crash" | "fall"; cell: number; progress: number } | null`, `rewardPop?: { value: number; cell: number; progress: number } | null`.

- [ ] **Step 1: Write the failing test**

```typescript
// append to src/examples/grid-world/__tests__/scene.test.ts
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
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm exec vitest run src/examples/grid-world/__tests__/scene.test.ts`
Expected: FAIL — `cellQuadrant` not exported.

- [ ] **Step 3: Implement**

In `src/examples/grid-world/scene.ts`, add `cellQuadrant` (after `cellAtPoint`), extend `SceneState`, and replace `drawScene` with the richer renderer. Add `ACTIONS` to the gridworld import.

Change the import:

```typescript
import { ACTIONS, type Action, type Policy, type World } from "@/shared/rl/gridworld";
```

Add the helper:

```typescript
/** The triangular quadrant for `action` within a cell: two cell corners + the center. */
export function cellQuadrant(
  layout: GridLayout,
  cell: number,
  action: Action,
): { x: number; y: number }[] {
  const r = cellRect(layout, cell);
  const c = { x: r.x + r.w / 2, y: r.y + r.h / 2 };
  const tl = { x: r.x, y: r.y };
  const tr = { x: r.x + r.w, y: r.y };
  const br = { x: r.x + r.w, y: r.y + r.h };
  const bl = { x: r.x, y: r.y + r.h };
  switch (action) {
    case "up":
      return [tl, tr, c];
    case "right":
      return [tr, br, c];
    case "down":
      return [br, bl, c];
    case "left":
      return [bl, tl, c];
  }
}
```

Extend `SceneState`:

```typescript
export interface SceneState {
  world: World;
  v: number[];
  policy: Policy;
  showPolicy: boolean;
  showValues: boolean;
  fromCell: number;
  toCell: number;
  progress: number; // 0..1 along from→to
  maxAbs: number;
  valueView?: "v" | "q";
  q?: number[][]; // [cell][actionIndex] when valueView==="q"
  qMaxAbs?: number;
  effect?: { kind: "crash" | "fall"; cell: number; progress: number } | null;
  rewardPop?: { value: number; cell: number; progress: number } | null;
}
```

Replace the whole `drawScene` function (and keep the existing `lerp` helper below it) with:

```typescript
/** Render the full grid scene. Not unit-tested — verified visually. */
export function drawScene(ctx: CanvasRenderingContext2D, scene: SceneState): void {
  const { world, v, policy, showPolicy, showValues, maxAbs } = scene;
  const valueView = scene.valueView ?? "v";
  const layout = computeGridLayout(world.cols * 80, world.rows * 80, world.rows, world.cols);
  ctx.fillStyle = PALETTE.bg;
  ctx.fillRect(0, 0, layout.width, layout.height);

  for (let i = 0; i < world.cells.length; i++) {
    const rect = cellRect(layout, i);
    const type = world.cells[i];

    if (type === "wall") {
      ctx.fillStyle = "#05060f";
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
      ctx.strokeStyle = PALETTE.sky;
      ctx.strokeRect(rect.x + 0.5, rect.y + 0.5, rect.w - 1, rect.h - 1);
      continue;
    }

    if (valueView === "q" && scene.q && type !== "restaurant") {
      // four triangular quadrants colored by Q(s,a)
      const qMax = scene.qMaxAbs ?? maxAbs;
      ACTIONS.forEach((a, ai) => {
        const tri = cellQuadrant(layout, i, a);
        ctx.fillStyle = heatColor(scene.q![i]?.[ai] ?? 0, qMax);
        ctx.beginPath();
        ctx.moveTo(tri[0].x, tri[0].y);
        ctx.lineTo(tri[1].x, tri[1].y);
        ctx.lineTo(tri[2].x, tri[2].y);
        ctx.closePath();
        ctx.fill();
      });
    } else {
      ctx.fillStyle = heatColor(v[i] ?? 0, maxAbs);
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    }
    ctx.strokeStyle = PALETTE.sky;
    ctx.strokeRect(rect.x + 0.5, rect.y + 0.5, rect.w - 1, rect.h - 1);

    drawCellSprite(ctx, rect, type);

    if (valueView === "q" && scene.q && type !== "restaurant") {
      ctx.fillStyle = PALETTE.ink;
      ctx.font = `7px ${PIXEL_FONT}`;
      ctx.textAlign = "center";
      const cx = rect.x + rect.w / 2;
      const cy = rect.y + rect.h / 2;
      ctx.fillText((scene.q[i]?.[0] ?? 0).toFixed(1), cx, rect.y + 10); // up
      ctx.fillText((scene.q[i]?.[2] ?? 0).toFixed(1), cx, rect.y + rect.h - 4); // down
      ctx.fillText((scene.q[i]?.[3] ?? 0).toFixed(1), rect.x + 12, cy + 3); // left
      ctx.fillText((scene.q[i]?.[1] ?? 0).toFixed(1), rect.x + rect.w - 12, cy + 3); // right
    } else if (showValues) {
      ctx.fillStyle = PALETTE.ink;
      ctx.font = `9px ${PIXEL_FONT}`;
      ctx.textAlign = "center";
      ctx.fillText((v[i] ?? 0).toFixed(1), rect.x + rect.w / 2, rect.y + rect.h - 8);
    }

    if (showPolicy && type !== "restaurant") {
      ctx.fillStyle = PALETTE.accent;
      ctx.font = `16px ${PIXEL_FONT}`;
      ctx.textAlign = "center";
      ctx.fillText(ARROW[policy[i]], rect.x + rect.w / 2, rect.y + rect.h / 2 + 6);
    }
  }

  // character interpolated from fromCell to toCell
  const from = cellRect(layout, scene.fromCell);
  const to = cellRect(layout, scene.toCell);
  const t = Math.max(0, Math.min(1, scene.progress));
  const cx = lerp(from.x, to.x, t) + from.w / 2;
  let cy = lerp(from.y, to.y, t) + from.h / 2;

  const effect = scene.effect ?? null;
  // manhole fall: sink the character as the effect progresses
  let charScale = 1;
  if (effect && effect.kind === "fall") {
    charScale = 1 - effect.progress;
    cy += effect.progress * 10;
  }
  const halfW = 8 * charScale;
  const bodyH = 20 * charScale;
  ctx.fillStyle = PALETTE.body;
  ctx.fillRect(Math.round(cx - halfW), Math.round(cy - bodyH / 2), Math.round(halfW * 2), Math.round(bodyH));
  ctx.fillStyle = PALETTE.skin;
  ctx.fillRect(Math.round(cx - 6 * charScale), Math.round(cy - bodyH / 2 - 8 * charScale), Math.round(12 * charScale), Math.round(8 * charScale));

  // car-crash effect: a car slides across the row + a burst flashes
  if (effect && effect.kind === "crash") {
    const rect = cellRect(layout, effect.cell);
    const carX = lerp(layout.originX, layout.originX + layout.width, effect.progress);
    const carY = rect.y + rect.h / 2;
    ctx.fillStyle = PALETTE.bad;
    ctx.fillRect(Math.round(carX - 14), Math.round(carY - 8), 28, 16);
    ctx.fillStyle = PALETTE.star;
    ctx.font = `20px ${PIXEL_FONT}`;
    ctx.textAlign = "center";
    if (effect.progress < 0.6) ctx.fillText("✺", cx, cy - 14);
  }

  // floating reward number
  const pop = scene.rewardPop ?? null;
  if (pop) {
    const rect = cellRect(layout, pop.cell);
    const px = rect.x + rect.w / 2;
    const py = rect.y + rect.h / 2 - pop.progress * 28;
    ctx.globalAlpha = Math.max(0, 1 - pop.progress);
    ctx.fillStyle = pop.value >= 0 ? PALETTE.good : PALETTE.bad;
    ctx.font = `12px ${PIXEL_FONT}`;
    ctx.textAlign = "center";
    ctx.fillText(`${pop.value > 0 ? "+" : ""}${pop.value}`, px, py);
    ctx.globalAlpha = 1;
  }
}

function drawCellSprite(
  ctx: CanvasRenderingContext2D,
  rect: CellRect,
  type: World["cells"][number],
): void {
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  if (type === "road" || type === "crosswalk") {
    // dashed center lane line across the cell
    ctx.strokeStyle = "#d9d9d9";
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(rect.x, cy);
    ctx.lineTo(rect.x + rect.w, cy);
    ctx.stroke();
    ctx.setLineDash([]);
    if (type === "crosswalk") {
      ctx.fillStyle = "#f4f4f4";
      for (let s = 0; s < 4; s++) {
        ctx.fillRect(rect.x + 8 + s * 16, rect.y + 6, 8, rect.h - 12);
      }
    }
  } else if (type === "manhole") {
    ctx.fillStyle = "#1a1c2c";
    ctx.beginPath();
    ctx.arc(cx, cy, Math.min(rect.w, rect.h) * 0.28, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#94b0c2";
    ctx.lineWidth = 2;
    ctx.stroke();
  } else if (type === "poutine") {
    ctx.fillStyle = "#a86b32"; // bowl
    ctx.fillRect(cx - 12, cy - 2, 24, 12);
    ctx.fillStyle = "#ffcd75"; // fries
    ctx.fillRect(cx - 10, cy - 10, 20, 8);
  } else if (type === "restaurant") {
    ctx.fillStyle = "#b13e53";
    ctx.fillRect(rect.x + 8, rect.y + 14, rect.w - 16, rect.h - 22);
    ctx.fillStyle = PALETTE.ink;
    ctx.fillRect(rect.x + 6, rect.y + 8, rect.w - 12, 8); // sign
    ctx.fillStyle = PALETTE.accent;
    ctx.font = `7px ${PIXEL_FONT}`;
    ctx.textAlign = "center";
    ctx.fillText("CLAUDETTE", cx, rect.y + 14);
  }
}
```

> Note: `drawScene` and `drawCellSprite` are renderers — not unit-tested. Only `cellQuadrant` is. The `CELL_LABEL` constant is now unused; remove it to keep the file clean.

- [ ] **Step 4: Run to verify pass + typecheck**

Run: `pnpm exec vitest run src/examples/grid-world/__tests__/scene.test.ts`
Expected: PASS.
Run: `pnpm typecheck`
Expected: clean (the page still compiles — new `SceneState` fields are optional).

- [ ] **Step 5: Commit**

```bash
git add src/examples/grid-world/scene.ts src/examples/grid-world/__tests__/scene.test.ts
git commit -m "feat: cell sprites, Q quadrants, and hazard/reward effects in scene"
```

---

## Task 5: Segmented toggle components (value view, policy type, control mode)

**Files:**
- Create: `src/examples/grid-world/ValueViewTabs.tsx`, `PolicyTypeTabs.tsx`, `ControlModeTabs.tsx`
- Test: `src/examples/grid-world/__tests__/ToggleTabs.test.tsx`

**Interfaces:**
- Produces:
  - `ValueView = "v" | "q"`; `ValueViewTabs({ value, onChange })`.
  - `PolicyType = "deterministic" | "epsilon"`; `PolicyTypeTabs({ value, onChange })`.
  - `ControlMode = "policy" | "manual"`; `ControlModeTabs({ value, onChange })`.

- [ ] **Step 1: Write the failing test**

```tsx
// src/examples/grid-world/__tests__/ToggleTabs.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ValueViewTabs } from "../ValueViewTabs";
import { PolicyTypeTabs } from "../PolicyTypeTabs";
import { ControlModeTabs } from "../ControlModeTabs";

describe("ValueViewTabs", () => {
  it("marks the active view and fires onChange", () => {
    const onChange = vi.fn();
    render(<ValueViewTabs value="v" onChange={onChange} />);
    expect(screen.getByText("V(s)").getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(screen.getByText("Q(s,a)"));
    expect(onChange).toHaveBeenCalledWith("q");
  });
});

describe("PolicyTypeTabs", () => {
  it("fires onChange with the clicked policy type", () => {
    const onChange = vi.fn();
    render(<PolicyTypeTabs value="deterministic" onChange={onChange} />);
    fireEvent.click(screen.getByText("ε-soft"));
    expect(onChange).toHaveBeenCalledWith("epsilon");
  });
});

describe("ControlModeTabs", () => {
  it("fires onChange with the clicked control mode", () => {
    const onChange = vi.fn();
    render(<ControlModeTabs value="policy" onChange={onChange} />);
    fireEvent.click(screen.getByText("Manual (arrow keys)"));
    expect(onChange).toHaveBeenCalledWith("manual");
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm exec vitest run src/examples/grid-world/__tests__/ToggleTabs.test.tsx`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement**

```tsx
// src/examples/grid-world/ValueViewTabs.tsx
export type ValueView = "v" | "q";
const ORDER: { value: ValueView; label: string }[] = [
  { value: "v", label: "V(s)" },
  { value: "q", label: "Q(s,a)" },
];
export function ValueViewTabs({
  value,
  onChange,
}: {
  value: ValueView;
  onChange: (v: ValueView) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5" role="tablist">
      {ORDER.map((o) => (
        <button key={o.value} aria-pressed={o.value === value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
```

```tsx
// src/examples/grid-world/PolicyTypeTabs.tsx
export type PolicyType = "deterministic" | "epsilon";
const ORDER: { value: PolicyType; label: string }[] = [
  { value: "deterministic", label: "Deterministic" },
  { value: "epsilon", label: "ε-soft" },
];
export function PolicyTypeTabs({
  value,
  onChange,
}: {
  value: PolicyType;
  onChange: (v: PolicyType) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5" role="tablist">
      {ORDER.map((o) => (
        <button key={o.value} aria-pressed={o.value === value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
```

```tsx
// src/examples/grid-world/ControlModeTabs.tsx
export type ControlMode = "policy" | "manual";
const ORDER: { value: ControlMode; label: string }[] = [
  { value: "policy", label: "Auto (policy)" },
  { value: "manual", label: "Manual (arrow keys)" },
];
export function ControlModeTabs({
  value,
  onChange,
}: {
  value: ControlMode;
  onChange: (v: ControlMode) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5" role="tablist">
      {ORDER.map((o) => (
        <button key={o.value} aria-pressed={o.value === value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm exec vitest run src/examples/grid-world/__tests__/ToggleTabs.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/examples/grid-world/ValueViewTabs.tsx src/examples/grid-world/PolicyTypeTabs.tsx src/examples/grid-world/ControlModeTabs.tsx src/examples/grid-world/__tests__/ToggleTabs.test.tsx
git commit -m "feat: value-view, policy-type, and control-mode toggle components"
```

---

## Task 6: ReturnTracker component

**Files:**
- Create: `src/examples/grid-world/ReturnTracker.tsx`
- Test: `src/examples/grid-world/__tests__/ReturnTracker.test.tsx`

**Interfaces:**
- Produces: `ReturnTracker({ current, last })` — retro score readout.

- [ ] **Step 1: Write the failing test**

```tsx
// src/examples/grid-world/__tests__/ReturnTracker.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ReturnTracker } from "../ReturnTracker";

describe("ReturnTracker", () => {
  it("shows the current return and last return", () => {
    render(<ReturnTracker current={6} last={2} />);
    expect(screen.getByText(/RETURN/)).toBeTruthy();
    expect(screen.getByText(/6/)).toBeTruthy();
    expect(screen.getByText(/LAST/)).toBeTruthy();
    expect(screen.getByText(/2/)).toBeTruthy();
  });
  it("shows a dash for last when null", () => {
    render(<ReturnTracker current={0} last={null} />);
    expect(screen.getByText(/LAST/)).toBeTruthy();
    expect(screen.getByText(/—/)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm exec vitest run src/examples/grid-world/__tests__/ReturnTracker.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```tsx
// src/examples/grid-world/ReturnTracker.tsx
export function ReturnTracker({
  current,
  last,
}: {
  current: number;
  last: number | null;
}) {
  return (
    <div className="flex items-center gap-4 bg-panel px-3 py-2 font-pixel text-[12px] text-accent">
      <span>RETURN {formatScore(current)}</span>
      <span className="text-ink">LAST {last === null ? "—" : formatScore(last)}</span>
    </div>
  );
}

function formatScore(n: number): string {
  const rounded = Math.round(n);
  const sign = rounded < 0 ? "-" : "";
  return `${sign}${String(Math.abs(rounded)).padStart(4, "0")}`;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm exec vitest run src/examples/grid-world/__tests__/ReturnTracker.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/examples/grid-world/ReturnTracker.tsx src/examples/grid-world/__tests__/ReturnTracker.test.tsx
git commit -m "feat: 8-bit episode return tracker"
```

---

## Task 7: ConvergenceChart RMS metric selector

**Files:**
- Modify: `src/examples/grid-world/ConvergenceChart.tsx`
- Test: `src/examples/grid-world/__tests__/ConvergenceChart.test.tsx` (append)

**Interfaces:**
- Consumes: existing `ChartLine` (`{ label; color; series }`).
- Produces:
  - `RmsMetric = "path" | "visited" | "all"`; `RMS_METRIC_LABELS: Record<RmsMetric, string>`.
  - `ConvergenceChart` props gain optional `metric?: RmsMetric` and `onMetricChange?: (m: RmsMetric) => void`; renders a selector. The page passes the already-selected `lines`.

- [ ] **Step 1: Write the failing test**

```tsx
// append to src/examples/grid-world/__tests__/ConvergenceChart.test.tsx
import { vi } from "vitest";
import { fireEvent } from "@testing-library/react";
import { RMS_METRIC_LABELS } from "../ConvergenceChart";

describe("ConvergenceChart metric selector", () => {
  it("renders the three RMS metric options and fires onMetricChange", () => {
    const onMetricChange = vi.fn();
    render(
      <ConvergenceChart
        lines={[{ label: "TD(0)", color: "#41a6f6", series: [3, 2, 1] }]}
        metric="path"
        onMetricChange={onMetricChange}
      />,
    );
    expect(screen.getByText(RMS_METRIC_LABELS.path)).toBeTruthy();
    expect(screen.getByText(RMS_METRIC_LABELS.visited)).toBeTruthy();
    fireEvent.click(screen.getByText(RMS_METRIC_LABELS.all));
    expect(onMetricChange).toHaveBeenCalledWith("all");
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm exec vitest run src/examples/grid-world/__tests__/ConvergenceChart.test.tsx`
Expected: FAIL — `RMS_METRIC_LABELS` not exported; selector not rendered.

- [ ] **Step 3: Implement**

In `src/examples/grid-world/ConvergenceChart.tsx`: add the metric type/labels, extend the props, and render a selector row. Replace the component signature and the returned JSX header.

Add near the top (after the `ChartLine` interface):

```typescript
export type RmsMetric = "path" | "visited" | "all";
export const RMS_METRIC_LABELS: Record<RmsMetric, string> = {
  path: "RMS (path)",
  visited: "RMS (visited)",
  all: "RMS (all)",
};
const METRIC_ORDER: RmsMetric[] = ["path", "visited", "all"];
```

Change the component signature:

```typescript
export function ConvergenceChart({
  lines,
  metric = "path",
  onMetricChange,
}: {
  lines: ChartLine[];
  metric?: RmsMetric;
  onMetricChange?: (m: RmsMetric) => void;
}) {
```

In the returned JSX, replace the `<h3>` line with a header that includes the selector:

```tsx
      <div className="mb-1 flex items-center justify-between gap-2">
        <h3 className="text-[11px]">RMS error vs. true V(s)</h3>
        <div className="flex gap-1" role="group" aria-label="RMS metric">
          {METRIC_ORDER.map((m) => (
            <button
              key={m}
              aria-pressed={m === metric}
              onClick={() => onMetricChange?.(m)}
              className="text-[8px]"
            >
              {RMS_METRIC_LABELS[m]}
            </button>
          ))}
        </div>
      </div>
```

- [ ] **Step 4: Run to verify pass + typecheck**

Run: `pnpm exec vitest run src/examples/grid-world/__tests__/ConvergenceChart.test.tsx`
Expected: PASS (new + existing chart tests).
Run: `pnpm typecheck`
Expected: clean (page still passes only `lines` — new props optional).

- [ ] **Step 5: Commit**

```bash
git add src/examples/grid-world/ConvergenceChart.tsx src/examples/grid-world/__tests__/ConvergenceChart.test.tsx
git commit -m "feat: RMS metric selector (path/visited/all) on convergence chart"
```

---

## Task 8: Page wiring (GridWorldExample) + world.ts defaults

**Files:**
- Modify: `src/examples/grid-world/world.ts` (add defaults)
- Modify: `src/examples/grid-world/GridWorldExample.tsx` (full rewrite)
- Test: `src/examples/grid-world/__tests__/GridWorldExample.test.tsx` (append)

**Interfaces:**
- Consumes everything from Tasks 1–7 plus existing modules.
- Produces: the wired page (no new exports consumed elsewhere).

- [ ] **Step 1: Add world.ts defaults**

Append to `src/examples/grid-world/world.ts`:

```typescript
export const DEFAULT_EPSILON = 0.1;
export const DEFAULT_POLICY_TYPE = "deterministic" as const;
export const DEFAULT_CONTROL_MODE = "policy" as const;
```

- [ ] **Step 2: Write the failing tests**

```tsx
// append to src/examples/grid-world/__tests__/GridWorldExample.test.tsx
// (render, screen, fireEvent and the renderPage helper are already at the top of this file)

describe("GridWorldExample v2 controls", () => {
  it("toggles to the Q(s,a) view", () => {
    renderPage();
    const qBtn = screen.getByText("Q(s,a)");
    fireEvent.click(qBtn);
    expect(qBtn.getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByLabelText("Grid world animation")).toBeTruthy();
  });

  it("shows the arrow-key hint and hides the Episode button in Manual mode", () => {
    renderPage();
    fireEvent.click(screen.getByText("Manual (arrow keys)"));
    expect(screen.getByText(/Use arrow keys to move/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Run one episode" })).toBeNull();
  });

  it("shows the return tracker", () => {
    renderPage();
    expect(screen.getByText(/RETURN/)).toBeTruthy();
  });
});
```

> The existing `renderPage` helper and the two v1 tests stay as-is.

- [ ] **Step 3: Run to verify failure**

Run: `pnpm exec vitest run src/examples/grid-world/__tests__/GridWorldExample.test.tsx`
Expected: FAIL — no Q toggle / Manual tab / return tracker yet.

- [ ] **Step 4: Rewrite `GridWorldExample.tsx`**

Replace the entire file with:

```tsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  allStates,
  computeQ,
  reachableStates,
  solveV,
  type Action,
  type Policy,
  type World,
} from "@/shared/rl/gridworld";
import type { Method } from "@/shared/rl/td-estimators";
import { fitCanvas } from "@/shared/pixel/canvas";
import { PALETTE } from "@/shared/pixel/palette";
import { PlaybackControls } from "@/shared/ui/PlaybackControls";
import { SpeedSelector } from "@/shared/ui/SpeedSelector";
import { EventLog } from "@/shared/ui/EventLog";
import { Toggle } from "@/shared/ui/Toggle";
import { RUN_COLORS } from "@/shared/ui/chart";
import { MethodTabs, METHOD_LABELS } from "./MethodTabs";
import { StateValueTable } from "./StateValueTable";
import { GridSettings } from "./GridSettings";
import {
  ConvergenceChart,
  type ChartLine,
  type RmsMetric,
} from "./ConvergenceChart";
import { ValueViewTabs, type ValueView } from "./ValueViewTabs";
import { PolicyTypeTabs, type PolicyType } from "./PolicyTypeTabs";
import { ControlModeTabs, type ControlMode } from "./ControlModeTabs";
import { ReturnTracker } from "./ReturnTracker";
import { computeGridLayout, cellAtPoint, drawScene, type SceneState } from "./scene";
import {
  chooseAction,
  createSim,
  derive,
  episodeReturn,
  errorSeries,
  runEpisode,
  stepBack,
  stepForward,
  visitedStates,
  currentCell,
  type SimConfig,
  type SimState,
} from "./simulation";
import {
  DEFAULT_ALPHA,
  DEFAULT_CONTROL_MODE,
  DEFAULT_EPSILON,
  DEFAULT_GAMMA,
  DEFAULT_N,
  DEFAULT_POLICY,
  DEFAULT_POLICY_TYPE,
  DEFAULT_SEED,
  DEFAULT_WORLD,
  SCENE_H,
  SCENE_W,
} from "./world";

const ACTION_CYCLE: Record<Action, Action> = {
  right: "down",
  down: "left",
  left: "up",
  up: "right",
};
const KEY_TO_ACTION: Record<string, Action> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
};
const BASE_STEP_MS = 320;
const EFFECT_MS = 500;

interface Anim {
  fromCell: number;
  toCell: number;
  progress: number;
}
type Effect = { kind: "crash" | "fall"; cell: number; progress: number } | null;
type RewardPop = { value: number; cell: number; progress: number } | null;

interface SavedRun {
  label: string;
  color: string;
  rmsPath: number[];
  rmsVisited: number[];
  rmsAll: number[];
}

export function GridWorldExample() {
  const [method, setMethod] = useState<Method>("td0");
  const [alpha, setAlpha] = useState(DEFAULT_ALPHA);
  const [gamma, setGamma] = useState(DEFAULT_GAMMA);
  const [n, setN] = useState(DEFAULT_N);
  const [world, setWorld] = useState<World>(DEFAULT_WORLD);
  const [policy, setPolicy] = useState<Policy>(DEFAULT_POLICY);
  const [seed, setSeed] = useState(DEFAULT_SEED);
  const [policyType, setPolicyType] = useState<PolicyType>(DEFAULT_POLICY_TYPE);
  const [epsilon, setEpsilon] = useState(DEFAULT_EPSILON);
  const [controlMode, setControlMode] = useState<ControlMode>(DEFAULT_CONTROL_MODE);
  const [valueView, setValueView] = useState<ValueView>("v");
  const [showPolicy, setShowPolicy] = useState(true);
  const [showTrue, setShowTrue] = useState(false);
  const [showLog, setShowLog] = useState(true);
  const [showChart, setShowChart] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [savedRuns, setSavedRuns] = useState<SavedRun[]>([]);
  const [chartMetric, setChartMetric] = useState<RmsMetric>("path");
  const runIdRef = useRef(0);

  const config: SimConfig = useMemo(
    () => ({ world, policy, method, alpha, gamma, n, seed, policyType, epsilon, controlMode }),
    [world, policy, method, alpha, gamma, n, seed, policyType, epsilon, controlMode],
  );
  const simRef = useRef<SimState>(createSim(config));
  const animRef = useRef<Anim>({ fromCell: world.start, toCell: world.start, progress: 1 });
  const effectRef = useRef<Effect>(null);
  const popRef = useRef<RewardPop>(null);
  const [, forceTick] = useState(0);
  const rerender = useCallback(() => forceTick((t) => t + 1), []);

  const vTrue = useMemo(
    () => solveV(world, policy, gamma, policyType === "epsilon" ? epsilon : 0),
    [world, policy, gamma, policyType, epsilon],
  );
  const states = useMemo(() => reachableStates(world, policy), [world, policy]);
  const stateLabels = useMemo(
    () => states.map((s) => `r${Math.floor(s / world.cols)}c${s % world.cols}`),
    [states, world.cols],
  );
  const maxAbs = useMemo(() => Math.max(1, ...vTrue.map((x) => Math.abs(x))), [vTrue]);

  // Snapshot the previous run from ITS OWN config (no stale closure on page state).
  const snapshotRun = useCallback((sim: SimState) => {
    if (sim.pointer === 0) return;
    const c = sim.config;
    const vT = solveV(c.world, c.policy, c.gamma, c.policyType === "epsilon" ? (c.epsilon ?? 0) : 0);
    const rmsPath = errorSeries(sim, vT, reachableStates(c.world, c.policy));
    if (rmsPath.length < 2) return;
    const id = runIdRef.current++;
    setSavedRuns((prev) => [
      ...prev,
      {
        label: `Run ${id + 1} · ${METHOD_LABELS[c.method]}`,
        color: RUN_COLORS[id % RUN_COLORS.length],
        rmsPath,
        rmsVisited: errorSeries(sim, vT, visitedStates(sim)),
        rmsAll: errorSeries(sim, vT, allStates(c.world)),
      },
    ]);
  }, []);

  useEffect(() => {
    snapshotRun(simRef.current);
    simRef.current = createSim(config);
    animRef.current = { fromCell: config.world.start, toCell: config.world.start, progress: 1 };
    effectRef.current = null;
    popRef.current = null;
    setLog([]);
    setIsPlaying(false);
    rerender();
  }, [config, rerender, snapshotRun]);

  const derived = derive(simRef.current);
  const ret = episodeReturn(simRef.current);

  const liveSeries = useCallback(
    (metric: RmsMetric): number[] => {
      const sim = simRef.current;
      const set =
        metric === "path"
          ? states
          : metric === "visited"
            ? visitedStates(sim)
            : allStates(world);
      return errorSeries(sim, vTrue, set);
    },
    [states, vTrue, world],
  );

  const chartLines: ChartLine[] = useMemo(() => {
    const pick = (r: SavedRun) =>
      chartMetric === "path" ? r.rmsPath : chartMetric === "visited" ? r.rmsVisited : r.rmsAll;
    const saved = savedRuns.map((r) => ({ label: r.label, color: r.color, series: pick(r) }));
    const live = liveSeries(chartMetric);
    if (live.length < 2) return saved;
    return [
      ...saved,
      { label: `${METHOD_LABELS[method]} (current)`, color: PALETTE.accent, series: live },
    ];
    // derived.episode keeps the live line current as episodes complete
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedRuns, chartMetric, liveSeries, method, derived.episode]);

  const applyOutcome = useCallback(
    (record: { state: number; reward: number; nextState: number; done: boolean }) => {
      animRef.current = { fromCell: record.state, toCell: record.nextState, progress: 0 };
      const type = world.cells[record.nextState];
      const penalty = record.reward < -world.reward.stepCost - 1e-9;
      if (type === "road" && penalty) effectRef.current = { kind: "crash", cell: record.nextState, progress: 0 };
      else if (type === "manhole" && penalty) effectRef.current = { kind: "fall", cell: record.nextState, progress: 0 };
      if (record.reward !== 0) popRef.current = { value: record.reward, cell: record.nextState, progress: 0 };
      setLog((l) => [...l, `Step ${simRef.current.pointer} · ${stepSummary(record.reward, record.done)}`]);
      rerender();
    },
    [world, rerender],
  );

  const commitStep = useCallback(() => {
    const { state, record } = stepForward(simRef.current);
    simRef.current = state;
    applyOutcome(record);
  }, [applyOutcome]);

  const handleEpisode = useCallback(() => {
    setIsPlaying(false);
    simRef.current = runEpisode(simRef.current);
    animRef.current = { fromCell: world.start, toCell: currentCell(simRef.current), progress: 1 };
    setLog((l) => [...l, `— episode ${derive(simRef.current).episode} complete —`]);
    rerender();
  }, [rerender, world.start]);

  const handleStepBack = useCallback(() => {
    setIsPlaying(false);
    simRef.current = stepBack(simRef.current);
    setLog((l) => l.slice(0, simRef.current.pointer));
    rerender();
  }, [rerender]);

  const handleReset = useCallback(() => {
    setIsPlaying(false);
    setSeed((s) => (s + 0x9e3779b9) >>> 0);
  }, []);

  const handleCanvasClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!showPolicy) return;
      const canvas = e.currentTarget;
      const rect = canvas.getBoundingClientRect();
      const px = ((e.clientX - rect.left) / rect.width) * SCENE_W;
      const py = ((e.clientY - rect.top) / rect.height) * SCENE_H;
      const layout = computeGridLayout(SCENE_W, SCENE_H, world.rows, world.cols);
      const cell = cellAtPoint(layout, px, py);
      if (cell === null) return;
      if (world.cells[cell] === "wall" || world.cells[cell] === "restaurant") return;
      setPolicy((prev) => {
        const next = prev.slice();
        next[cell] = ACTION_CYCLE[prev[cell]];
        return next;
      });
    },
    [showPolicy, world],
  );

  // Manual mode: arrow keys drive the character.
  useEffect(() => {
    if (controlMode !== "manual") return;
    const onKey = (e: KeyboardEvent) => {
      const a = KEY_TO_ACTION[e.key];
      if (!a) return;
      e.preventDefault();
      setIsPlaying(false);
      const { state, record } = chooseAction(simRef.current, a);
      simRef.current = state;
      applyOutcome(record);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [controlMode, applyOutcome]);

  const qTrue = useMemo(() => computeQ(world, vTrue, gamma), [world, vTrue, gamma]);
  const qMaxAbs = useMemo(
    () => Math.max(1, ...qTrue.flat().map((x) => Math.abs(x))),
    [qTrue],
  );

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const lastTsRef = useRef<number | null>(null);
  useEffect(() => {
    let raf = 0;
    const tick = (ts: number) => {
      const last = lastTsRef.current ?? ts;
      const dt = ts - last;
      lastTsRef.current = ts;

      const a = animRef.current;
      if (a.progress < 1) {
        a.progress = Math.min(1, a.progress + dt / (BASE_STEP_MS / speed));
      } else if (isPlaying && controlMode === "policy") {
        commitStep();
      }
      if (effectRef.current) {
        effectRef.current.progress += dt / EFFECT_MS;
        if (effectRef.current.progress >= 1) effectRef.current = null;
      }
      if (popRef.current) {
        popRef.current.progress += dt / (EFFECT_MS + 100);
        if (popRef.current.progress >= 1) popRef.current = null;
      }

      const canvas = canvasRef.current;
      if (canvas) {
        const dpr = window.devicePixelRatio || 1;
        const dims = fitCanvas(canvas, SCENE_W, SCENE_H, dpr);
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.setTransform(dims.width / SCENE_W, 0, 0, dims.height / SCENE_H, 0, 0);
          const cur = animRef.current;
          const scene: SceneState = {
            world,
            v: derive(simRef.current).v,
            policy,
            showPolicy,
            showValues: true,
            fromCell: cur.fromCell,
            toCell: cur.toCell,
            progress: cur.progress,
            maxAbs,
            valueView,
            q: valueView === "q" ? computeQ(world, derive(simRef.current).v, gamma) : undefined,
            qMaxAbs,
            effect: effectRef.current,
            rewardPop: popRef.current,
          };
          drawScene(ctx, scene);
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      lastTsRef.current = null;
    };
  }, [speed, isPlaying, controlMode, commitStep, world, policy, showPolicy, maxAbs, valueView, qMaxAbs, gamma]);

  useEffect(() => {
    if (!showSettings) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowSettings(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showSettings]);

  const manual = controlMode === "manual";

  return (
    <div className="mx-auto max-w-[1200px] p-4">
      <p>
        <Link to="/">← All demos</Link>
      </p>
      <h1 className="text-[16px]">Grid World: Policy Evaluation</h1>

      <MethodTabs value={method} onChange={setMethod} />

      <div className="my-3 flex flex-wrap items-center gap-3">
        <ValueViewTabs value={valueView} onChange={setValueView} />
        <ControlModeTabs value={controlMode} onChange={setControlMode} />
        {!manual && <PolicyTypeTabs value={policyType} onChange={setPolicyType} />}
        {!manual && policyType === "epsilon" && (
          <label className="flex items-center gap-1.5">
            ε = {epsilon.toFixed(2)}
            <input type="range" min="0" max="1" step="0.01" value={epsilon}
              onChange={(e) => setEpsilon(Number(e.target.value))} />
          </label>
        )}
      </div>

      <div className="my-3 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-1.5">
          α = {alpha.toFixed(2)}
          <input type="range" min="0.01" max="1" step="0.01" value={alpha}
            onChange={(e) => setAlpha(Number(e.target.value))} />
        </label>
        <label className="flex items-center gap-1.5">
          γ = {gamma.toFixed(2)}
          <input type="range" min="0.5" max="0.99" step="0.01" value={gamma}
            onChange={(e) => setGamma(Number(e.target.value))} />
        </label>
        {method === "nstep" && (
          <label className="flex items-center gap-1.5">
            n =
            <input type="number" min="1" max="50" step="1" value={n}
              className="w-[56px] border-2 border-ink bg-bg px-1 text-ink"
              onChange={(e) => setN(Math.max(1, Math.floor(Number(e.target.value))))} />
          </label>
        )}
        <Toggle label="Show policy" checked={showPolicy} onChange={setShowPolicy} />
        <Toggle label="Show true value" checked={showTrue} onChange={setShowTrue} />
        <Toggle label="Event log" checked={showLog} onChange={setShowLog} />
        <Toggle label="Chart" checked={showChart} onChange={setShowChart} />
        <button onClick={() => setShowSettings((s) => !s)} aria-label="Settings">
          Settings
        </button>
      </div>

      {manual ? (
        <p className="mb-2 text-[10px] text-accent">Use arrow keys to move.</p>
      ) : (
        showPolicy && (
          <p className="mb-2 text-[10px] text-accent">
            Click a cell to change its action (→ ↓ ← ↑).
          </p>
        )
      )}

      <div className="my-3 flex items-stretch gap-3">
        {showLog && (
          <div className="relative min-w-0 shrink basis-[200px]">
            <div className="absolute inset-0">
              <EventLog entries={log} />
            </div>
          </div>
        )}
        <div className="flex min-w-0 shrink grow basis-0 flex-col gap-2">
          <canvas
            ref={canvasRef}
            width={SCENE_W}
            height={SCENE_H}
            aria-label="Grid world animation"
            onClick={handleCanvasClick}
            className="block h-auto w-full"
          />
          <ReturnTracker current={ret.current} last={ret.last} />
          <div className="flex flex-wrap justify-between gap-4">
            <div className="flex flex-wrap gap-1.5">
              <PlaybackControls
                isPlaying={isPlaying}
                onStepBack={handleStepBack}
                onStepForward={() => {
                  setIsPlaying(false);
                  commitStep();
                }}
                onTogglePlay={() => setIsPlaying((p) => !p)}
                onReset={handleReset}
                manual={manual}
              />
              {!manual && (
                <button onClick={handleEpisode} aria-label="Run one episode">
                  Episode ▶▶
                </button>
              )}
            </div>
            {!manual && <SpeedSelector value={speed} onChange={setSpeed} />}
          </div>
        </div>
        {showChart && (
          <div className="min-w-0 shrink basis-[320px]">
            <ConvergenceChart
              lines={chartLines}
              metric={chartMetric}
              onMetricChange={setChartMetric}
            />
          </div>
        )}
      </div>

      <StateValueTable
        states={states}
        labels={stateLabels}
        v={derived.v}
        vTrue={vTrue}
        showTrue={showTrue}
        episode={derived.episode}
        rms={rmsOf(derived.v, vTrue, states)}
      />

      {showSettings && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setShowSettings(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Settings"
            className="max-h-[85vh] w-full max-w-[480px] overflow-auto border-2 border-ink bg-bg p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between gap-4">
              <h2 className="text-[14px]">Hazards & rewards</h2>
              <button onClick={() => setShowSettings(false)} aria-label="Close settings">
                Close
              </button>
            </div>
            <GridSettings
              reward={world.reward}
              onChange={(reward) => setWorld((w) => ({ ...w, reward }))}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function rmsOf(v: number[], vTrue: number[], states: number[]): number {
  if (states.length === 0) return 0;
  let sum = 0;
  for (const s of states) sum += (v[s] - vTrue[s]) ** 2;
  return Math.sqrt(sum / states.length);
}

function stepSummary(reward: number, done: boolean): string {
  const r = reward === 0 ? "no reward" : `reward ${reward > 0 ? "+" : ""}${reward}`;
  return done ? `${r} · reached restaurant` : r;
}
```

- [ ] **Step 5: Run tests + typecheck**

Run: `pnpm exec vitest run src/examples/grid-world/__tests__/GridWorldExample.test.tsx`
Expected: PASS (v1 mount/episode tests + the three v2 tests).
Run: `pnpm typecheck`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/examples/grid-world/world.ts src/examples/grid-world/GridWorldExample.tsx src/examples/grid-world/__tests__/GridWorldExample.test.tsx
git commit -m "feat: wire grid-world v2 (epsilon-soft, Q view, chart metrics, manual mode, effects, return tracker)"
```

---

## Task 9: Full-suite check + documentation

**Files:**
- Modify: `README.md`, `AGENTS.md`

**Interfaces:** none (docs + verification only).

- [ ] **Step 1: Full verification**

Run: `pnpm exec vitest run`
Expected: all tests pass.
Run: `pnpm typecheck`
Expected: clean.
Run: `pnpm build`
Expected: succeeds.

If any fail, STOP and fix before documenting.

- [ ] **Step 2: Update README**

In the "Grid World — Policy Evaluation" section of `README.md`, append:

```markdown
The grid world also supports:

- **V(s) / Q(s,a) toggle** — switch the grid between state values and model-derived
  state-action values (four triangular quadrants per cell).
- **ε-soft policy** — make the policy stochastic (with probability ε take a random action);
  the analytical ground truth follows the ε-soft policy.
- **Chart metrics** — measure RMS error over the greedy path, the visited states, or all states.
- **Manual mode** — drive the character with the arrow keys and watch the estimates update.
- Recognizable cell sprites (road, crosswalk, manhole, poutine, restaurant), crash/fall
  animations, floating reward numbers, and an 8-bit episode return tracker.
```

- [ ] **Step 3: Update AGENTS.md**

In `AGENTS.md`, under the `src/shared/rl/gridworld.ts` entry, note `solveV(…, epsilon)`,
`computeQ`, and `allStates`. Under the `src/examples/grid-world/` block, add the new
components (`ValueViewTabs`, `PolicyTypeTabs`, `ControlModeTabs`, `ReturnTracker`) and note
that `simulation.ts` now supports ε-soft stepping (`policyType`/`epsilon`), manual
`chooseAction`, and the `visitedStates`/`episodeReturn` helpers; and that `scene.ts`
renders cell sprites, Q quadrants (`cellQuadrant`), and hazard/reward effects.

- [ ] **Step 4: Commit**

```bash
git add README.md AGENTS.md
git commit -m "docs: document grid-world v2 features"
```

---

## Final verification

- [ ] `pnpm exec vitest run` — all green.
- [ ] `pnpm typecheck` — clean.
- [ ] `pnpm build` — succeeds.
- [ ] Manual: `pnpm dev` — exercise V/Q toggle, ε-soft + ε slider (agent wanders), the three chart metrics, Manual mode arrow keys, and confirm sprites/crash/fall/reward-pop/return-tracker all render; ε=0 + Auto + V view matches v1.
