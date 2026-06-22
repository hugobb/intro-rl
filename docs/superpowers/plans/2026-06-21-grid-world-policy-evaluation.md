# Grid World Policy Evaluation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a second interactive RL demo — a grid world that evaluates a fixed, editable deterministic policy with Monte Carlo, TD(0), and n-step TD, showing the `V(s)` estimates converge to an analytical ground truth.

**Architecture:** Pure RL logic (`gridworld.ts`, `td-estimators.ts`) lives in `src/shared/rl/` with no React/DOM. A trajectory + seeded-RNG state machine (`simulation.ts`) records environment steps and derives `V(s)` by replaying the chosen estimator over the trajectory prefix (so MC/n-step delayed updates rewind correctly). A canvas scene renders the grid, a `V(s)` heatmap, the character, and an editable policy-arrow overlay. The page component (`GridWorldExample.tsx`) composes shared UI widgets, mirroring the existing `BanditExample.tsx`.

**Tech Stack:** Vite, React 19 + TypeScript (strict), React Router, plain `<canvas>` 2D, Vitest + jsdom + @testing-library/react, Tailwind v4. Package manager: pnpm.

## Global Constraints

- **TypeScript strict; no `any`; explicit exported types.** (from AGENTS.md conventions)
- **`src/shared/rl/` is pure** — no React, DOM, or canvas imports; type-only imports from other `rl/` modules are fine. (AGENTS.md)
- **Rendering isolated** in `scene.ts` `drawScene` + `src/shared/pixel/`; pure math helpers are unit-tested, renderers are not. (AGENTS.md)
- **Import alias:** use `@/` for `src/` (e.g. `@/shared/rl/rng`); example-local imports use `./`. (existing tsconfig + bandit code)
- **Tests co-located** in `__tests__/` next to the code. (AGENTS.md)
- **Styling:** Tailwind utility classes; palette + pixel font are `@theme` tokens (`bg-bg`, `text-ink`, `font-pixel`, `PALETTE` from `@/shared/pixel/palette`). (AGENTS.md)
- **Default `γ < 1`** so the analytical solver always converges even for hand-edited looping policies. (spec)
- **Commands:** `pnpm test` (vitest run), `pnpm test:watch`, `pnpm typecheck`, `pnpm dev`, `pnpm build`. (package.json)
- **Run a single test file:** `pnpm exec vitest run <path>`.

---

## File Structure

**New pure logic — `src/shared/rl/`:**
- `gridworld.ts` — world/cell/action/policy types, `nextCell`, `step` (sampled), `expectedReward`, `reachableStates`, `solveV` (iterative policy evaluation → analytical `V`).
- `td-estimators.ts` — `Method`, `Transition`, `EvalParams`, `computeValues` (MC / TD(0) / n-step over a transition list), `rmsError`.

**New example — `src/examples/grid-world/`:**
- `world.ts` — `parseWorld`, `DEFAULT_WORLD`, `DEFAULT_POLICY`, default params/constants.
- `simulation.ts` — trajectory state machine: `createSim`, `stepForward`, `stepBack`, `runEpisode`, `reset`, `derive`, `errorSeries`, `currentCell`.
- `scene.ts` — `computeGridLayout`, `cellRect`, `cellAtPoint`, `heatColor` (pure math, tested) + `drawScene` (renderer, not tested).
- `MethodTabs.tsx` — MC / TD(0) / n-step segmented control.
- `StateValueTable.tsx` — per-state `V_est` / `V_true` / error table + summary.
- `GridSettings.tsx` — hazard-probability and reward editor (`x1/x2/r1–r4/stepCost`).
- `ConvergenceChart.tsx` — RMS-error-vs-episode line chart (reuses `chartBounds`/`projectPoint` from `@/shared/ui/chart`).
- `GridWorldExample.tsx` — page composition + `requestAnimationFrame` loop.

**Modified:**
- `src/main.tsx` — add `/grid-world` route.
- `src/pages/Landing.tsx` — add a card to `EXAMPLES`.
- `README.md`, `AGENTS.md` — document the new demo.

---

## Task 1: Grid world types, movement, and `step`

**Files:**
- Create: `src/shared/rl/gridworld.ts`
- Test: `src/shared/rl/__tests__/gridworld.test.ts`

**Interfaces:**
- Consumes: `RNG` from `@/shared/rl/rng` (`{ next(): number; int(n): number }`).
- Produces:
  - `type Action = "up" | "down" | "left" | "right"`; `const ACTIONS: Action[]`
  - `type CellType = "empty" | "wall" | "road" | "crosswalk" | "manhole" | "poutine" | "start" | "restaurant"`
  - `interface RewardConfig { x1; x2; r1; r2; r3; r4; stepCost: number }`
  - `interface World { rows: number; cols: number; cells: CellType[]; start: number; reward: RewardConfig }`
  - `type Policy = Action[]` (length `rows*cols`, one action per cell)
  - `interface StepResult { next: number; reward: number; done: boolean }`
  - `cellIndex(world, row, col): number`, `isTerminal(world, cell): boolean`, `nextCell(world, cell, action): number`, `step(world, cell, action, rng): StepResult`, `expectedReward(world, cell, action): number`

- [ ] **Step 1: Write the failing test**

```typescript
// src/shared/rl/__tests__/gridworld.test.ts
import { describe, it, expect } from "vitest";
import { createRng } from "@/shared/rl/rng";
import {
  nextCell,
  step,
  expectedReward,
  isTerminal,
  type World,
} from "@/shared/rl/gridworld";

// 1x3 corridor: [start, road, restaurant], policy moves right.
function corridor(): World {
  return {
    rows: 1,
    cols: 3,
    cells: ["start", "road", "restaurant"],
    start: 0,
    reward: { x1: 0.5, x2: 0.3, r1: 4, r2: 6, r3: 4, r4: 10, stepCost: 0 },
  };
}

describe("nextCell", () => {
  it("moves within bounds", () => {
    expect(nextCell(corridor(), 0, "right")).toBe(1);
  });
  it("stays put when moving off the board", () => {
    expect(nextCell(corridor(), 0, "left")).toBe(0);
    expect(nextCell(corridor(), 0, "up")).toBe(0);
  });
  it("stays put when moving into a wall", () => {
    const w: World = { ...corridor(), cells: ["start", "wall", "restaurant"] };
    expect(nextCell(w, 0, "right")).toBe(0);
  });
});

describe("step", () => {
  it("marks done when entering the restaurant and pays r4", () => {
    const r = step(corridor(), 1, "right", createRng(1));
    expect(r.next).toBe(2);
    expect(r.done).toBe(true);
    expect(r.reward).toBe(10);
  });
  it("samples the road hazard: -r1 with prob x1, else 0", () => {
    const w = corridor();
    let accidents = 0;
    const rng = createRng(7);
    for (let i = 0; i < 2000; i++) {
      // entering cell 1 (road) from cell 0
      const r = step(w, 0, "right", rng);
      if (r.reward === -w.reward.r1) accidents++;
      else expect(r.reward).toBe(0);
    }
    expect(accidents / 2000).toBeGreaterThan(0.4);
    expect(accidents / 2000).toBeLessThan(0.6);
  });
});

describe("expectedReward", () => {
  it("is the expected reward of the ENTERED cell", () => {
    const w = corridor();
    // entering road (cell 1): -x1*r1 = -0.5*4 = -2
    expect(expectedReward(w, 0, "right")).toBeCloseTo(-2);
    // entering restaurant (cell 2): r4 = 10
    expect(expectedReward(w, 1, "right")).toBeCloseTo(10);
  });
  it("subtracts stepCost", () => {
    const w: World = { ...corridor(), reward: { ...corridor().reward, stepCost: 1 } };
    expect(expectedReward(w, 1, "right")).toBeCloseTo(9); // 10 - 1
  });
});

describe("isTerminal", () => {
  it("is true only for restaurant cells", () => {
    expect(isTerminal(corridor(), 2)).toBe(true);
    expect(isTerminal(corridor(), 0)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/shared/rl/__tests__/gridworld.test.ts`
Expected: FAIL — cannot find module `@/shared/rl/gridworld`.

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/shared/rl/gridworld.ts
import type { RNG } from "@/shared/rl/rng";

export type Action = "up" | "down" | "left" | "right";
export const ACTIONS: Action[] = ["up", "right", "down", "left"];

export type CellType =
  | "empty"
  | "wall"
  | "road"
  | "crosswalk"
  | "manhole"
  | "poutine"
  | "start"
  | "restaurant";

export interface RewardConfig {
  x1: number; // accident probability on a road (off-crosswalk) cell
  x2: number; // manhole fall probability
  r1: number; // accident penalty magnitude (applied as -r1)
  r2: number; // manhole penalty magnitude (applied as -r2)
  r3: number; // poutine reward
  r4: number; // restaurant (terminal) reward
  stepCost: number; // per-step cost (>= 0), applied as -stepCost
}

export interface World {
  rows: number;
  cols: number;
  cells: CellType[]; // length rows*cols, row-major
  start: number; // cell index
  reward: RewardConfig;
}

export type Policy = Action[]; // length rows*cols, one action per cell

export interface StepResult {
  next: number;
  reward: number;
  done: boolean;
}

export function cellIndex(world: World, row: number, col: number): number {
  return row * world.cols + col;
}

export function isTerminal(world: World, cell: number): boolean {
  return world.cells[cell] === "restaurant";
}

export function nextCell(world: World, cell: number, action: Action): number {
  let row = Math.floor(cell / world.cols);
  let col = cell % world.cols;
  if (action === "up") row -= 1;
  else if (action === "down") row += 1;
  else if (action === "left") col -= 1;
  else col += 1;
  if (row < 0 || row >= world.rows || col < 0 || col >= world.cols) return cell;
  const dest = row * world.cols + col;
  if (world.cells[dest] === "wall") return cell;
  return dest;
}

/** Expected reward of ENTERING `cell` (excludes step cost). */
function enterRewardExpected(world: World, cell: number): number {
  const rw = world.reward;
  switch (world.cells[cell]) {
    case "restaurant":
      return rw.r4;
    case "poutine":
      return rw.r3;
    case "road":
      return -rw.x1 * rw.r1;
    case "manhole":
      return -rw.x2 * rw.r2;
    default:
      return 0; // empty, crosswalk, start, wall
  }
}

/** Sampled reward of ENTERING `cell` (excludes step cost). */
function enterRewardSample(world: World, cell: number, rng: RNG): number {
  const rw = world.reward;
  switch (world.cells[cell]) {
    case "restaurant":
      return rw.r4;
    case "poutine":
      return rw.r3;
    case "road":
      return rng.next() < rw.x1 ? -rw.r1 : 0;
    case "manhole":
      return rng.next() < rw.x2 ? -rw.r2 : 0;
    default:
      return 0;
  }
}

export function step(
  world: World,
  cell: number,
  action: Action,
  rng: RNG,
): StepResult {
  const next = nextCell(world, cell, action);
  const reward = enterRewardSample(world, next, rng) - world.reward.stepCost;
  return { next, reward, done: isTerminal(world, next) };
}

/** Expected immediate reward of taking `action` in `cell` (for the analytical solver). */
export function expectedReward(world: World, cell: number, action: Action): number {
  const next = nextCell(world, cell, action);
  return enterRewardExpected(world, next) - world.reward.stepCost;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/shared/rl/__tests__/gridworld.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add src/shared/rl/gridworld.ts src/shared/rl/__tests__/gridworld.test.ts
git commit -m "feat: grid-world MDP types, movement, and step/expectedReward"
```

---

## Task 2: Analytical solver + reachable states

**Files:**
- Modify: `src/shared/rl/gridworld.ts` (append `reachableStates`, `solveV`)
- Test: `src/shared/rl/__tests__/gridworld.test.ts` (append cases)

**Interfaces:**
- Consumes: `World`, `Policy`, `nextCell`, `isTerminal`, `expectedReward` from Task 1.
- Produces:
  - `reachableStates(world, policy): number[]` — non-terminal cells visited following `policy` from `start`, no repeats, loop-guarded.
  - `solveV(world, policy, gamma, tol?, maxIters?): number[]` — `V` per cell via iterative policy evaluation (`V[terminal] = 0`, `V[wall] = 0`).

- [ ] **Step 1: Write the failing test**

```typescript
// append to src/shared/rl/__tests__/gridworld.test.ts
import { reachableStates, solveV, type Policy } from "@/shared/rl/gridworld";

describe("solveV", () => {
  it("solves a 3-cell corridor with discounting", () => {
    // [start, empty, restaurant], all "right", r4=10, gamma=0.9
    const w: World = {
      rows: 1,
      cols: 3,
      cells: ["start", "empty", "restaurant"],
      start: 0,
      reward: { x1: 0, x2: 0, r1: 0, r2: 0, r3: 0, r4: 10, stepCost: 0 },
    };
    const pol: Policy = ["right", "right", "right"];
    const V = solveV(w, pol, 0.9);
    expect(V[2]).toBeCloseTo(0); // terminal
    expect(V[1]).toBeCloseTo(10); // 10 + 0.9*0
    expect(V[0]).toBeCloseTo(9); // 0 + 0.9*10
  });

  it("accounts for expected hazard cost (gamma=1)", () => {
    // [start, road, restaurant], x1=0.5 r1=4 r4=10
    const w: World = {
      rows: 1,
      cols: 3,
      cells: ["start", "road", "restaurant"],
      start: 0,
      reward: { x1: 0.5, x2: 0, r1: 4, r2: 0, r3: 0, r4: 10, stepCost: 0 },
    };
    const pol: Policy = ["right", "right", "right"];
    const V = solveV(w, pol, 1);
    expect(V[1]).toBeCloseTo(10);
    expect(V[0]).toBeCloseTo(8); // -2 (expected road) + 10
  });
});

describe("reachableStates", () => {
  it("returns the policy chain up to (excluding) the terminal", () => {
    const w: World = {
      rows: 1,
      cols: 3,
      cells: ["start", "empty", "restaurant"],
      start: 0,
      reward: { x1: 0, x2: 0, r1: 0, r2: 0, r3: 0, r4: 0, stepCost: 0 },
    };
    expect(reachableStates(w, ["right", "right", "right"])).toEqual([0, 1]);
  });
  it("terminates on a looping policy without hanging", () => {
    const w: World = {
      rows: 1,
      cols: 3,
      cells: ["start", "empty", "empty"],
      start: 0,
      reward: { x1: 0, x2: 0, r1: 0, r2: 0, r3: 0, r4: 0, stepCost: 0 },
    };
    // 0 -> right -> 1 -> left -> 0 -> ... (loop)
    const out = reachableStates(w, ["right", "left", "left"]);
    expect(out).toEqual([0, 1]); // no repeats, no infinite loop
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/shared/rl/__tests__/gridworld.test.ts`
Expected: FAIL — `reachableStates` / `solveV` not exported.

- [ ] **Step 3: Write minimal implementation**

```typescript
// append to src/shared/rl/gridworld.ts

/** Non-terminal cells visited by following `policy` from start, no repeats. */
export function reachableStates(world: World, policy: Policy): number[] {
  const seen = new Set<number>();
  const order: number[] = [];
  let cell = world.start;
  const cap = world.rows * world.cols * 4;
  let guard = 0;
  while (!isTerminal(world, cell) && !seen.has(cell) && guard < cap) {
    seen.add(cell);
    order.push(cell);
    cell = nextCell(world, cell, policy[cell]);
    guard += 1;
  }
  return order;
}

/**
 * Exact V(s) for a deterministic policy via iterative policy evaluation
 * (repeated Bellman backups to tolerance). For gamma < 1 this converges for any
 * policy; it is the analytical-ground-truth reference for the demo. V is 0 for
 * walls and terminal cells.
 */
export function solveV(
  world: World,
  policy: Policy,
  gamma: number,
  tol = 1e-9,
  maxIters = 100000,
): number[] {
  const n = world.cells.length;
  const V = new Array<number>(n).fill(0);
  for (let iter = 0; iter < maxIters; iter++) {
    let delta = 0;
    for (let s = 0; s < n; s++) {
      if (world.cells[s] === "wall" || isTerminal(world, s)) continue;
      const a = policy[s];
      const sp = nextCell(world, s, a);
      const v = expectedReward(world, s, a) + gamma * (isTerminal(world, sp) ? 0 : V[sp]);
      delta = Math.max(delta, Math.abs(v - V[s]));
      V[s] = v;
    }
    if (delta < tol) break;
  }
  return V;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/shared/rl/__tests__/gridworld.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/shared/rl/gridworld.ts src/shared/rl/__tests__/gridworld.test.ts
git commit -m "feat: analytical V(s) solver and reachable-states for grid world"
```

---

## Task 3: TD(0) and Monte Carlo estimators

**Files:**
- Create: `src/shared/rl/td-estimators.ts`
- Test: `src/shared/rl/__tests__/td-estimators.test.ts`

**Interfaces:**
- Consumes: nothing external (operates on plain `Transition` arrays).
- Produces:
  - `type Method = "mc" | "td0" | "nstep"`
  - `interface Transition { state: number; reward: number; nextState: number; done: boolean }`
  - `interface EvalParams { method: Method; alpha: number; gamma: number; n: number; numStates: number }`
  - `computeValues(transitions: Transition[], p: EvalParams): number[]`
  - `rmsError(vEst: number[], vTrue: number[], states: number[]): number`
  - (n-step branch added in Task 4; this task implements `td0` and `mc` and throws on `nstep`.)

- [ ] **Step 1: Write the failing test**

```typescript
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/shared/rl/__tests__/td-estimators.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/shared/rl/td-estimators.ts
export type Method = "mc" | "td0" | "nstep";

export interface Transition {
  state: number;
  reward: number;
  nextState: number;
  done: boolean;
}

export interface EvalParams {
  method: Method;
  alpha: number;
  gamma: number;
  n: number; // window length for n-step (ignored otherwise)
  numStates: number;
}

/**
 * Derive V(s) by replaying the chosen estimator over `transitions` from a
 * zero-initialized value function. Pure: the same input always yields the same
 * output, which is what makes step/rewind/replay correct for the delayed
 * (MC / n-step) updates — there is no in-place state to un-wind.
 */
export function computeValues(transitions: Transition[], p: EvalParams): number[] {
  const V = new Array<number>(p.numStates).fill(0);
  if (p.method === "td0") return applyTd0(V, transitions, p);
  if (p.method === "mc") return applyMc(V, transitions, p);
  return applyNStep(V, transitions, p);
}

function applyTd0(V: number[], trans: Transition[], p: EvalParams): number[] {
  for (const t of trans) {
    const target = t.reward + p.gamma * (t.done ? 0 : V[t.nextState]);
    V[t.state] += p.alpha * (target - V[t.state]);
  }
  return V;
}

function applyMc(V: number[], trans: Transition[], p: EvalParams): number[] {
  let ep: Transition[] = [];
  for (const t of trans) {
    ep.push(t);
    if (!t.done) continue;
    // Episode complete: compute returns backward, then every-visit update.
    let G = 0;
    const returns = new Array<number>(ep.length);
    for (let i = ep.length - 1; i >= 0; i--) {
      G = ep[i].reward + p.gamma * G;
      returns[i] = G;
    }
    for (let i = 0; i < ep.length; i++) {
      const s = ep[i].state;
      V[s] += p.alpha * (returns[i] - V[s]);
    }
    ep = [];
  }
  // A trailing incomplete episode contributes no updates (MC waits for the end).
  return V;
}

// n-step implementation lands in Task 4; throw until then so an accidental
// "nstep" call fails loudly rather than silently returning zeros.
function applyNStep(_V: number[], _trans: Transition[], _p: EvalParams): number[] {
  throw new Error("n-step estimator not implemented yet");
}

/** RMS error of `vEst` vs `vTrue` over the given state indices. */
export function rmsError(
  vEst: number[],
  vTrue: number[],
  states: number[],
): number {
  if (states.length === 0) return 0;
  let sum = 0;
  for (const s of states) {
    const d = vEst[s] - vTrue[s];
    sum += d * d;
  }
  return Math.sqrt(sum / states.length);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/shared/rl/__tests__/td-estimators.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/shared/rl/td-estimators.ts src/shared/rl/__tests__/td-estimators.test.ts
git commit -m "feat: TD(0) and Monte Carlo policy-evaluation estimators"
```

---

## Task 4: n-step TD estimator

**Files:**
- Modify: `src/shared/rl/td-estimators.ts` (replace `applyNStep` body)
- Test: `src/shared/rl/__tests__/td-estimators.test.ts` (append cases)

**Interfaces:**
- Consumes: `Transition`, `EvalParams`, `computeValues` from Task 3.
- Produces: working `nstep` branch of `computeValues`. Invariant: `n=1` equals `td0`; `n ≥ episode length` equals `mc`.

- [ ] **Step 1: Write the failing test**

```typescript
// append to src/shared/rl/__tests__/td-estimators.test.ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/shared/rl/__tests__/td-estimators.test.ts`
Expected: FAIL — `applyNStep` throws "not implemented yet".

- [ ] **Step 3: Write minimal implementation**

```typescript
// in src/shared/rl/td-estimators.ts, replace the applyNStep stub with:

function applyNStep(V: number[], trans: Transition[], p: EvalParams): number[] {
  const n = Math.max(1, Math.floor(p.n));
  let ep: Transition[] = [];
  let applied = 0; // states in the current episode already updated

  // Apply every state whose full n-step window is now available. The bootstrap
  // state after n transitions from tau is ep[tau+n-1].nextState (= terminal at
  // episode end, where V is 0).
  const applyFullWindows = () => {
    while (ep.length >= applied + n) {
      const tau = applied;
      let G = 0;
      for (let k = n - 1; k >= 0; k--) G = ep[tau + k].reward + p.gamma * G;
      const bootCell = ep[tau + n - 1].nextState;
      G += Math.pow(p.gamma, n) * V[bootCell];
      V[ep[tau].state] += p.alpha * (G - V[ep[tau].state]);
      applied += 1;
    }
  };

  for (const t of trans) {
    ep.push(t);
    if (!t.done) {
      applyFullWindows();
      continue;
    }
    // Episode end: close any remaining full windows, then flush the tail states
    // (their windows reach the terminal, so no bootstrap).
    applyFullWindows();
    const L = ep.length;
    for (let tau = applied; tau < L; tau++) {
      let G = 0;
      for (let k = L - 1; k >= tau; k--) G = ep[k].reward + p.gamma * G;
      V[ep[tau].state] += p.alpha * (G - V[ep[tau].state]);
    }
    ep = [];
    applied = 0;
  }
  // Trailing incomplete episode keeps only its already-applied closed windows.
  return V;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/shared/rl/__tests__/td-estimators.test.ts`
Expected: PASS (all n-step cases plus the Task 3 cases).

- [ ] **Step 5: Commit**

```bash
git add src/shared/rl/td-estimators.ts src/shared/rl/__tests__/td-estimators.test.ts
git commit -m "feat: n-step TD estimator (n=1 == TD(0), large-n == MC)"
```

---

## Task 5: Default world + policy data

**Files:**
- Create: `src/examples/grid-world/world.ts`
- Test: `src/examples/grid-world/__tests__/world.test.ts`

**Interfaces:**
- Consumes: `World`, `Policy`, `CellType`, `Action`, `RewardConfig`, `reachableStates`, `solveV` from `@/shared/rl/gridworld`.
- Produces:
  - `parseWorld(rows: string[], reward: RewardConfig): World`
  - `DEFAULT_REWARD: RewardConfig`
  - `DEFAULT_WORLD: World`
  - `DEFAULT_POLICY: Policy`
  - `DEFAULT_ALPHA = 0.1`, `DEFAULT_GAMMA = 0.9`, `DEFAULT_N = 3`, `DEFAULT_SEED = 12345`
  - `SCENE_W = 560`, `SCENE_H = 480`

- [ ] **Step 1: Write the failing test**

```typescript
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/examples/grid-world/__tests__/world.test.ts`
Expected: FAIL — module `../world` not found.

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/examples/grid-world/world.ts
import type {
  Action,
  CellType,
  Policy,
  RewardConfig,
  World,
} from "@/shared/rl/gridworld";

const CHAR_TO_CELL: Record<string, CellType> = {
  ".": "empty",
  "#": "wall",
  R: "road",
  C: "crosswalk",
  M: "manhole",
  P: "poutine",
  S: "start",
  G: "restaurant",
};

/** Build a World from an ASCII map (one string per row). */
export function parseWorld(rows: string[], reward: RewardConfig): World {
  const r = rows.length;
  const c = rows[0].length;
  const cells: CellType[] = [];
  let start = 0;
  for (let row = 0; row < r; row++) {
    for (let col = 0; col < c; col++) {
      const ch = rows[row][col];
      const type = CHAR_TO_CELL[ch];
      if (type === undefined) throw new Error(`Unknown map char '${ch}'`);
      if (type === "start") start = row * c + col;
      cells.push(type);
    }
  }
  return { rows: r, cols: c, cells, start, reward };
}

export const DEFAULT_REWARD: RewardConfig = {
  x1: 0.5, // off-crosswalk accident chance
  x2: 0.3, // manhole fall chance
  r1: 10, // accident penalty
  r2: 6, // manhole penalty
  r3: 4, // poutine reward
  r4: 10, // restaurant reward
  stepCost: 0,
};

// 6 rows x 7 cols. The default path: down col 0 (crossing the road off-crosswalk),
// right along row 3 (over the manhole), down to row 5, right to the poutine, then
// into Chez Claudette. The crosswalk (C, row 2 col 4) is safe scenery off the path.
const DEFAULT_MAP = [
  "S......",
  ".#..#..",
  "RRRRCRR",
  "..M....",
  ".#..#..",
  ".....PG",
];

export const DEFAULT_WORLD: World = parseWorld(DEFAULT_MAP, DEFAULT_REWARD);

function makeDefaultPolicy(world: World): Policy {
  const pol: Policy = new Array<Action>(world.cells.length).fill("up");
  const set = (row: number, col: number, a: Action) => {
    pol[row * world.cols + col] = a;
  };
  set(0, 0, "down");
  set(1, 0, "down");
  set(2, 0, "down");
  set(3, 0, "right");
  set(3, 1, "right");
  set(3, 2, "right");
  set(3, 3, "down");
  set(4, 3, "down");
  set(5, 3, "right");
  set(5, 4, "right");
  set(5, 5, "right");
  return pol;
}

export const DEFAULT_POLICY: Policy = makeDefaultPolicy(DEFAULT_WORLD);

export const DEFAULT_ALPHA = 0.1;
export const DEFAULT_GAMMA = 0.9;
export const DEFAULT_N = 3;
export const DEFAULT_SEED = 12345;

export const SCENE_W = 560;
export const SCENE_H = 480;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/examples/grid-world/__tests__/world.test.ts`
Expected: PASS. (If the path test fails, the policy/map are inconsistent — fix the arrows so the chain reaches `G`.)

- [ ] **Step 5: Commit**

```bash
git add src/examples/grid-world/world.ts src/examples/grid-world/__tests__/world.test.ts
git commit -m "feat: default grid-world map, policy, and constants"
```

---

## Task 6: Simulation trajectory state machine

**Files:**
- Create: `src/examples/grid-world/simulation.ts`
- Test: `src/examples/grid-world/__tests__/simulation.test.ts`

**Interfaces:**
- Consumes: `createRng`/`RNG` from `@/shared/rl/rng`; `step`, `isTerminal`, `World`, `Policy` from `@/shared/rl/gridworld`; `computeValues`, `rmsError`, `Method`, `Transition` from `@/shared/rl/td-estimators`.
- Produces:
  - `interface SimConfig { world; policy; method; alpha; gamma; n; seed }`
  - `type StepRecord = Transition`
  - `interface SimState { config; trajectory: StepRecord[]; pointer: number; rng: RNG }`
  - `interface DerivedState { v: number[]; step: number; episode: number; current: number }`
  - `MAX_EPISODE_STEPS = 200`
  - `createSim`, `currentCell`, `stepForward`, `stepBack`, `runEpisode`, `reset`, `derive`, `errorSeries`

- [ ] **Step 1: Write the failing test**

```typescript
// src/examples/grid-world/__tests__/simulation.test.ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/examples/grid-world/__tests__/simulation.test.ts`
Expected: FAIL — module `../simulation` not found.

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/examples/grid-world/simulation.ts
import { createRng, type RNG } from "@/shared/rl/rng";
import { step, type Policy, type World } from "@/shared/rl/gridworld";
import {
  computeValues,
  rmsError,
  type EvalParams,
  type Method,
  type Transition,
} from "@/shared/rl/td-estimators";

export interface SimConfig {
  world: World;
  policy: Policy;
  method: Method;
  alpha: number;
  gamma: number;
  n: number;
  seed: number;
}

export type StepRecord = Transition;

export interface SimState {
  config: SimConfig;
  trajectory: StepRecord[];
  pointer: number;
  rng: RNG;
}

export interface DerivedState {
  v: number[];
  step: number;
  episode: number;
  current: number;
}

export const MAX_EPISODE_STEPS = 200;

export function createSim(config: SimConfig): SimState {
  return { config, trajectory: [], pointer: 0, rng: createRng(config.seed) };
}

/** Agent cell at the pointer: start, or the last applied step's nextState
 *  (unless that step ended an episode, in which case the next episode restarts). */
export function currentCell(state: SimState): number {
  if (state.pointer === 0) return state.config.world.start;
  const last = state.trajectory[state.pointer - 1];
  return last.done ? state.config.world.start : last.nextState;
}

function episodeStepCount(state: SimState): number {
  let count = 0;
  for (let i = state.pointer - 1; i >= 0; i--) {
    if (state.trajectory[i].done) break;
    count += 1;
  }
  return count;
}

export function stepForward(state: SimState): { state: SimState; record: StepRecord } {
  if (state.pointer < state.trajectory.length) {
    const record = state.trajectory[state.pointer];
    return { state: { ...state, pointer: state.pointer + 1 }, record };
  }
  const cell = currentCell(state);
  const action = state.config.policy[cell];
  const res = step(state.config.world, cell, action, state.rng);
  // Loop guard: truncate runaway episodes (e.g. a hand-edited looping policy) as
  // terminal so MC/n-step can flush their delayed updates and the run stays finite.
  const truncated = episodeStepCount(state) + 1 >= MAX_EPISODE_STEPS;
  const record: StepRecord = {
    state: cell,
    reward: res.reward,
    nextState: res.next,
    done: res.done || truncated,
  };
  return {
    state: {
      ...state,
      trajectory: state.trajectory.concat(record),
      pointer: state.pointer + 1,
    },
    record,
  };
}

export function stepBack(state: SimState): SimState {
  if (state.pointer === 0) return state;
  return { ...state, pointer: state.pointer - 1 };
}

/** Advance until the current episode ends (a done record is applied). */
export function runEpisode(state: SimState): SimState {
  let s = state;
  for (let i = 0; i <= MAX_EPISODE_STEPS; i++) {
    const out = stepForward(s);
    s = out.state;
    if (out.record.done) break;
  }
  return s;
}

export function reset(state: SimState, seed?: number): SimState {
  const newSeed = seed ?? state.config.seed;
  return {
    config: { ...state.config, seed: newSeed },
    trajectory: [],
    pointer: 0,
    rng: createRng(newSeed),
  };
}

function evalParams(config: SimConfig): EvalParams {
  return {
    method: config.method,
    alpha: config.alpha,
    gamma: config.gamma,
    n: config.n,
    numStates: config.world.cells.length,
  };
}

export function derive(state: SimState): DerivedState {
  const applied = state.trajectory.slice(0, state.pointer);
  const v = computeValues(applied, evalParams(state.config));
  let episode = 0;
  for (const t of applied) if (t.done) episode += 1;
  return { v, step: state.pointer, episode, current: currentCell(state) };
}

/** RMS error vs vTrue at each completed-episode boundary (index 0 = initial zeros). */
export function errorSeries(
  state: SimState,
  vTrue: number[],
  states: number[],
): number[] {
  const params = evalParams(state.config);
  const zero = new Array<number>(params.numStates).fill(0);
  const out: number[] = [rmsError(zero, vTrue, states)];
  const prefix: StepRecord[] = [];
  for (let i = 0; i < state.pointer; i++) {
    prefix.push(state.trajectory[i]);
    if (state.trajectory[i].done) {
      out.push(rmsError(computeValues(prefix, params), vTrue, states));
    }
  }
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/examples/grid-world/__tests__/simulation.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/examples/grid-world/simulation.ts src/examples/grid-world/__tests__/simulation.test.ts
git commit -m "feat: grid-world trajectory simulation with replayable V(s) derive"
```

---

## Task 7: Scene layout math + renderer

**Files:**
- Create: `src/examples/grid-world/scene.ts`
- Test: `src/examples/grid-world/__tests__/scene.test.ts`

**Interfaces:**
- Consumes: `World`, `Policy`, `Action` from `@/shared/rl/gridworld`; `PALETTE`, `PIXEL_FONT` from `@/shared/pixel/palette`.
- Produces:
  - `interface GridLayout { width; height; cell; originX; originY; rows; cols }`
  - `interface CellRect { x; y; w; h }`
  - `computeGridLayout(width, height, rows, cols): GridLayout`
  - `cellRect(layout, index): CellRect`
  - `cellAtPoint(layout, px, py): number | null`
  - `heatColor(v, maxAbs): string`
  - `interface SceneState { world; v: number[]; policy; showPolicy: boolean; showValues: boolean; fromCell; toCell; progress; maxAbs }`
  - `drawScene(ctx, scene): void` (not unit-tested)

- [ ] **Step 1: Write the failing test**

```typescript
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/examples/grid-world/__tests__/scene.test.ts`
Expected: FAIL — module `../scene` not found.

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/examples/grid-world/scene.ts
import { PALETTE, PIXEL_FONT } from "@/shared/pixel/palette";
import type { Action, Policy, World } from "@/shared/rl/gridworld";

export interface GridLayout {
  width: number;
  height: number;
  cell: number;
  originX: number;
  originY: number;
  rows: number;
  cols: number;
}

export interface CellRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function computeGridLayout(
  width: number,
  height: number,
  rows: number,
  cols: number,
): GridLayout {
  const cell = Math.floor(Math.min(width / cols, height / rows));
  const gridW = cell * cols;
  const gridH = cell * rows;
  return {
    width,
    height,
    cell,
    originX: Math.floor((width - gridW) / 2),
    originY: Math.floor((height - gridH) / 2),
    rows,
    cols,
  };
}

export function cellRect(layout: GridLayout, index: number): CellRect {
  const row = Math.floor(index / layout.cols);
  const col = index % layout.cols;
  return {
    x: layout.originX + col * layout.cell,
    y: layout.originY + row * layout.cell,
    w: layout.cell,
    h: layout.cell,
  };
}

export function cellAtPoint(
  layout: GridLayout,
  px: number,
  py: number,
): number | null {
  const col = Math.floor((px - layout.originX) / layout.cell);
  const row = Math.floor((py - layout.originY) / layout.cell);
  if (col < 0 || col >= layout.cols || row < 0 || row >= layout.rows) return null;
  return row * layout.cols + col;
}

function lerpChannel(a: number, b: number, t: number): number {
  return Math.round(a + (b - a) * Math.max(0, Math.min(1, t)));
}

/** Diverging heatmap: red (negative) → neutral (0) → green (positive). */
export function heatColor(v: number, maxAbs: number): string {
  const neutral: [number, number, number] = [40, 44, 60];
  const good: [number, number, number] = [56, 183, 100]; // PALETTE.good
  const bad: [number, number, number] = [239, 125, 87]; // PALETTE.bad
  if (maxAbs <= 0) return `rgb(${neutral[0]},${neutral[1]},${neutral[2]})`;
  const t = Math.max(-1, Math.min(1, v / maxAbs));
  const target = t >= 0 ? good : bad;
  const m = Math.abs(t);
  const r = lerpChannel(neutral[0], target[0], m);
  const g = lerpChannel(neutral[1], target[1], m);
  const b = lerpChannel(neutral[2], target[2], m);
  return `rgb(${r},${g},${b})`;
}

const CELL_LABEL: Partial<Record<string, string>> = {
  manhole: "◳",
  poutine: "★",
  crosswalk: "≡",
  road: "≈",
  start: "▷",
  restaurant: "🍴",
};

const ARROW: Record<Action, string> = {
  up: "↑",
  down: "↓",
  left: "←",
  right: "→",
};

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
}

/** Render the full grid scene. Not unit-tested — verified visually. */
export function drawScene(ctx: CanvasRenderingContext2D, scene: SceneState): void {
  const { world, v, policy, showPolicy, showValues, maxAbs } = scene;
  const layout = computeGridLayout(scene.world.cols * 80, scene.world.rows * 80, world.rows, world.cols);
  ctx.fillStyle = PALETTE.bg;
  ctx.fillRect(0, 0, layout.width, layout.height);

  for (let i = 0; i < world.cells.length; i++) {
    const rect = cellRect(layout, i);
    const type = world.cells[i];
    // base fill: walls dark, others get the value heatmap
    ctx.fillStyle =
      type === "wall" ? "#05060f" : heatColor(v[i] ?? 0, maxAbs);
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    ctx.strokeStyle = PALETTE.sky;
    ctx.strokeRect(rect.x + 0.5, rect.y + 0.5, rect.w - 1, rect.h - 1);

    if (type !== "wall" && type !== "empty") {
      ctx.fillStyle = PALETTE.ink;
      ctx.font = `12px ${PIXEL_FONT}`;
      ctx.textAlign = "center";
      ctx.fillText(CELL_LABEL[type] ?? "", rect.x + rect.w / 2, rect.y + 16);
    }

    if (showValues && type !== "wall") {
      ctx.fillStyle = PALETTE.ink;
      ctx.font = `9px ${PIXEL_FONT}`;
      ctx.textAlign = "center";
      ctx.fillText((v[i] ?? 0).toFixed(1), rect.x + rect.w / 2, rect.y + rect.h - 8);
    }

    if (showPolicy && type !== "wall" && type !== "restaurant") {
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
  const cy = lerp(from.y, to.y, t) + from.h / 2;
  ctx.fillStyle = PALETTE.body;
  ctx.fillRect(Math.round(cx - 8), Math.round(cy - 10), 16, 20);
  ctx.fillStyle = PALETTE.skin;
  ctx.fillRect(Math.round(cx - 6), Math.round(cy - 18), 12, 10);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
```

> Note: `drawScene` is intentionally not unit-tested (canvas renderer). Only the math helpers above it are. The character-position expression is simplified during page wiring in Task 10 if visual tweaks are needed; it must remain a pure function of `fromCell`, `toCell`, and `progress`.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/examples/grid-world/__tests__/scene.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/examples/grid-world/scene.ts src/examples/grid-world/__tests__/scene.test.ts
git commit -m "feat: grid-world scene layout math, heatmap color, and renderer"
```

---

## Task 8: Method tabs, state-value table, and settings panel

**Files:**
- Create: `src/examples/grid-world/MethodTabs.tsx`
- Create: `src/examples/grid-world/StateValueTable.tsx`
- Create: `src/examples/grid-world/GridSettings.tsx`
- Test: `src/examples/grid-world/__tests__/MethodTabs.test.tsx`

**Interfaces:**
- Consumes: `Method` from `@/shared/rl/td-estimators`; `RewardConfig` from `@/shared/rl/gridworld`.
- Produces:
  - `METHOD_LABELS: Record<Method, string>`; `MethodTabs({ value, onChange })`
  - `StateValueTable({ states, labels, v, vTrue, showTrue, episode, rms })`
  - `GridSettings({ reward, onChange })` — number inputs for `x1`, `x2`, `r1`, `r2`, `r3`, `r4`, `stepCost`.

- [ ] **Step 1: Write the failing test**

```typescript
// src/examples/grid-world/__tests__/MethodTabs.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MethodTabs, METHOD_LABELS } from "../MethodTabs";

describe("MethodTabs", () => {
  it("renders a button per method and marks the active one", () => {
    render(<MethodTabs value="td0" onChange={() => {}} />);
    expect(screen.getByText(METHOD_LABELS.mc)).toBeTruthy();
    const active = screen.getByText(METHOD_LABELS.td0);
    expect(active.getAttribute("aria-pressed")).toBe("true");
  });

  it("calls onChange with the clicked method", () => {
    const onChange = vi.fn();
    render(<MethodTabs value="td0" onChange={onChange} />);
    fireEvent.click(screen.getByText(METHOD_LABELS.nstep));
    expect(onChange).toHaveBeenCalledWith("nstep");
  });
});

import { GridSettings } from "../GridSettings";
import type { RewardConfig } from "@/shared/rl/gridworld";

const REWARD: RewardConfig = { x1: 0.5, x2: 0.3, r1: 10, r2: 6, r3: 4, r4: 10, stepCost: 0 };

describe("GridSettings", () => {
  it("emits an updated RewardConfig when a field changes", () => {
    const onChange = vi.fn();
    render(<GridSettings reward={REWARD} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("x1"), { target: { value: "0.2" } });
    expect(onChange).toHaveBeenCalledWith({ ...REWARD, x1: 0.2 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/examples/grid-world/__tests__/MethodTabs.test.tsx`
Expected: FAIL — module `../MethodTabs` not found.

- [ ] **Step 3: Write minimal implementation**

```tsx
// src/examples/grid-world/MethodTabs.tsx
import type { Method } from "@/shared/rl/td-estimators";

export const METHOD_LABELS: Record<Method, string> = {
  mc: "Monte Carlo",
  td0: "TD(0)",
  nstep: "n-step TD",
};

const ORDER: Method[] = ["mc", "td0", "nstep"];

export function MethodTabs({
  value,
  onChange,
}: {
  value: Method;
  onChange: (m: Method) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5" role="tablist">
      {ORDER.map((m) => (
        <button key={m} aria-pressed={m === value} onClick={() => onChange(m)}>
          {METHOD_LABELS[m]}
        </button>
      ))}
    </div>
  );
}
```

```tsx
// src/examples/grid-world/StateValueTable.tsx
export function StateValueTable({
  states,
  labels,
  v,
  vTrue,
  showTrue,
  episode,
  rms,
}: {
  states: number[];
  labels: string[]; // parallel to states
  v: number[];
  vTrue: number[];
  showTrue: boolean;
  episode: number;
  rms: number;
}) {
  return (
    <div className="bg-panel p-2 text-[10px]">
      <div className="mb-1 flex justify-between">
        <span>Episodes: {episode}</span>
        {showTrue && <span>RMS error: {rms.toFixed(3)}</span>}
      </div>
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className="text-left">State</th>
            <th className="text-right">V est</th>
            {showTrue && <th className="text-right">V true</th>}
            {showTrue && <th className="text-right">|err|</th>}
          </tr>
        </thead>
        <tbody>
          {states.map((s, i) => (
            <tr key={s}>
              <td className="text-left">{labels[i]}</td>
              <td className="text-right">{(v[s] ?? 0).toFixed(2)}</td>
              {showTrue && <td className="text-right">{(vTrue[s] ?? 0).toFixed(2)}</td>}
              {showTrue && (
                <td className="text-right">
                  {Math.abs((v[s] ?? 0) - (vTrue[s] ?? 0)).toFixed(2)}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

```tsx
// src/examples/grid-world/GridSettings.tsx
import type { RewardConfig } from "@/shared/rl/gridworld";

interface Field {
  key: keyof RewardConfig;
  label: string;
  min: number;
  max: number;
  step: number;
}

const FIELDS: Field[] = [
  { key: "x1", label: "x1", min: 0, max: 1, step: 0.05 },
  { key: "x2", label: "x2", min: 0, max: 1, step: 0.05 },
  { key: "r1", label: "r1", min: 0, max: 100, step: 1 },
  { key: "r2", label: "r2", min: 0, max: 100, step: 1 },
  { key: "r3", label: "r3", min: 0, max: 100, step: 1 },
  { key: "r4", label: "r4", min: 0, max: 100, step: 1 },
  { key: "stepCost", label: "step cost", min: 0, max: 10, step: 0.1 },
];

const HINTS: Record<keyof RewardConfig, string> = {
  x1: "accident probability (off-crosswalk road)",
  x2: "manhole fall probability",
  r1: "accident penalty (applied as -r1)",
  r2: "manhole penalty (applied as -r2)",
  r3: "poutine reward",
  r4: "restaurant (terminal) reward",
  stepCost: "per-step cost (applied as -stepCost)",
};

export function GridSettings({
  reward,
  onChange,
}: {
  reward: RewardConfig;
  onChange: (r: RewardConfig) => void;
}) {
  return (
    <div className="grid gap-2 text-[11px]">
      {FIELDS.map((f) => (
        <label key={f.key} className="flex items-center justify-between gap-3">
          <span title={HINTS[f.key]}>
            {f.label} — {HINTS[f.key]}
          </span>
          <input
            type="number"
            aria-label={f.label}
            className="w-[72px] border-2 border-ink bg-bg px-1 text-ink"
            min={f.min}
            max={f.max}
            step={f.step}
            value={reward[f.key]}
            onChange={(e) =>
              onChange({ ...reward, [f.key]: Number(e.target.value) })
            }
          />
        </label>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/examples/grid-world/__tests__/MethodTabs.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/examples/grid-world/MethodTabs.tsx src/examples/grid-world/StateValueTable.tsx src/examples/grid-world/GridSettings.tsx src/examples/grid-world/__tests__/MethodTabs.test.tsx
git commit -m "feat: method tabs, state-value table, and settings panel for grid world"
```

---

## Task 9: Convergence chart

**Files:**
- Create: `src/examples/grid-world/ConvergenceChart.tsx`
- Test: `src/examples/grid-world/__tests__/ConvergenceChart.test.tsx`

**Interfaces:**
- Consumes: `chartBounds`, `projectPoint` from `@/shared/ui/chart`; `fitCanvas` from `@/shared/pixel/canvas`; `PALETTE`, `PIXEL_FONT` from `@/shared/pixel/palette`.
- Produces:
  - `interface ChartLine { label: string; color: string; series: number[] }`
  - `ConvergenceChart({ lines })` — RMS-error-vs-episode line chart with a legend.

- [ ] **Step 1: Write the failing test**

```tsx
// src/examples/grid-world/__tests__/ConvergenceChart.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ConvergenceChart } from "../ConvergenceChart";

describe("ConvergenceChart", () => {
  it("renders a labeled canvas and a legend entry per line", () => {
    render(
      <ConvergenceChart
        lines={[
          { label: "TD(0)", color: "#41a6f6", series: [3, 2, 1] },
          { label: "MC", color: "#38b764", series: [3, 1.5, 0.5] },
        ]}
      />,
    );
    expect(screen.getByLabelText("Convergence chart")).toBeTruthy();
    expect(screen.getByText("TD(0)")).toBeTruthy();
    expect(screen.getByText("MC")).toBeTruthy();
  });

  it("renders without throwing when there are no lines", () => {
    render(<ConvergenceChart lines={[]} />);
    expect(screen.getByLabelText("Convergence chart")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/examples/grid-world/__tests__/ConvergenceChart.test.tsx`
Expected: FAIL — module `../ConvergenceChart` not found.

- [ ] **Step 3: Write minimal implementation**

```tsx
// src/examples/grid-world/ConvergenceChart.tsx
import { useEffect, useRef } from "react";
import { chartBounds, projectPoint } from "@/shared/ui/chart";
import { fitCanvas } from "@/shared/pixel/canvas";
import { PALETTE, PIXEL_FONT } from "@/shared/pixel/palette";

export interface ChartLine {
  label: string;
  color: string;
  series: number[]; // RMS error per episode (index 0 = initial)
}

const W = 320;
const H = 240;
const PAD = 28;

export function ConvergenceChart({ lines }: { lines: ChartLine[] }) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const dims = fitCanvas(canvas, W, H, dpr);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dims.width / W, 0, 0, dims.height / H, 0, 0);
    ctx.fillStyle = PALETTE.bg;
    ctx.fillRect(0, 0, W, H);

    // axes
    ctx.strokeStyle = PALETTE.ground;
    ctx.beginPath();
    ctx.moveTo(PAD, PAD);
    ctx.lineTo(PAD, H - PAD);
    ctx.lineTo(W - PAD, H - PAD);
    ctx.stroke();
    ctx.fillStyle = PALETTE.ink;
    ctx.font = `8px ${PIXEL_FONT}`;
    ctx.textAlign = "center";
    ctx.fillText("episode →", W / 2, H - 6);

    const series = lines.map((l) => l.series);
    if (series.some((s) => s.length > 1)) {
      const bounds = chartBounds(series);
      lines.forEach((line) => {
        if (line.series.length < 2) return;
        ctx.strokeStyle = line.color;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        line.series.forEach((val, step) => {
          const p = projectPoint(step, val, bounds, W, H, PAD);
          if (step === 0) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
        });
        ctx.stroke();
      });
    }
  }, [lines]);

  return (
    <div className="bg-panel p-2">
      <h3 className="mb-1 text-[11px]">RMS error vs. true V(s)</h3>
      <canvas
        ref={ref}
        width={W}
        height={H}
        aria-label="Convergence chart"
        className="block h-auto w-full"
      />
      <ul className="mt-1 flex flex-wrap gap-2 text-[9px]">
        {lines.map((l) => (
          <li key={l.label} className="flex items-center gap-1">
            <span
              className="inline-block h-2 w-3"
              style={{ backgroundColor: l.color }}
            />
            {l.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/examples/grid-world/__tests__/ConvergenceChart.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/examples/grid-world/ConvergenceChart.tsx src/examples/grid-world/__tests__/ConvergenceChart.test.tsx
git commit -m "feat: RMS-error convergence chart for grid world"
```

---

## Task 10: Page composition (`GridWorldExample.tsx`)

**Files:**
- Create: `src/examples/grid-world/GridWorldExample.tsx`
- Test: `src/examples/grid-world/__tests__/GridWorldExample.test.tsx`

**Interfaces:**
- Consumes: everything above — `simulation.ts`, `scene.ts`, `world.ts`, `MethodTabs`, `StateValueTable`, `GridSettings`, `ConvergenceChart`, `solveV`/`reachableStates`/`RewardConfig` from `@/shared/rl/gridworld`, shared widgets (`PlaybackControls`, `SpeedSelector`, `EventLog`, `Toggle`), `fitCanvas`, `PALETTE`.
- Produces: `GridWorldExample()` default-style export used by the route in Task 11.

**Notes for the implementer:** This mirrors `BanditExample.tsx`. Key differences: the playback bar has an extra **Episode** button (runs `runEpisode`); clicking the canvas while "Show policy" is on cycles a cell's action; a **Settings** modal (`GridSettings`) edits `world.reward` (`x1/x2/r1–r4/stepCost`), and because `vTrue` and the sim `config` both depend on `world`, editing a reward auto-resets the run and recomputes the analytical `V`; the auto-reset effect snapshots the just-finished run's `errorSeries` as a saved chart line. The heatmap `maxAbs` is `max(1, max|V_true|)` so colors stay stable as estimates grow. Also add an Escape-to-close effect for the settings modal, matching `BanditExample.tsx`.

- [ ] **Step 1: Write the failing test**

```tsx
// src/examples/grid-world/__tests__/GridWorldExample.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { GridWorldExample } from "../GridWorldExample";
import { METHOD_LABELS } from "../MethodTabs";

function renderPage() {
  return render(
    <MemoryRouter>
      <GridWorldExample />
    </MemoryRouter>,
  );
}

describe("GridWorldExample", () => {
  it("mounts with the method tabs and playback controls", () => {
    renderPage();
    expect(screen.getByText(METHOD_LABELS.mc)).toBeTruthy();
    expect(screen.getByLabelText("Grid world animation")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Run one episode" })).toBeTruthy();
  });

  it("advances the episode counter when stepping forward", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Run one episode" }));
    // episode counter is rendered by StateValueTable; after one episode it is >= 1
    expect(screen.getByText(/Episodes:\s*[1-9]/)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/examples/grid-world/__tests__/GridWorldExample.test.tsx`
Expected: FAIL — module `../GridWorldExample` not found.

- [ ] **Step 3: Write minimal implementation**

```tsx
// src/examples/grid-world/GridWorldExample.tsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  reachableStates,
  solveV,
  type Action,
  type Policy,
  type RewardConfig,
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
import { ConvergenceChart, type ChartLine } from "./ConvergenceChart";
import { computeGridLayout, cellAtPoint, drawScene, type SceneState } from "./scene";
import {
  createSim,
  derive,
  errorSeries,
  runEpisode,
  stepBack,
  stepForward,
  currentCell,
  type SimConfig,
  type SimState,
} from "./simulation";
import {
  DEFAULT_ALPHA,
  DEFAULT_GAMMA,
  DEFAULT_N,
  DEFAULT_POLICY,
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
const BASE_STEP_MS = 320;

interface Anim {
  fromCell: number;
  toCell: number;
  progress: number; // 0..1; 1 = settled
}

export function GridWorldExample() {
  const [method, setMethod] = useState<Method>("td0");
  const [alpha, setAlpha] = useState(DEFAULT_ALPHA);
  const [gamma, setGamma] = useState(DEFAULT_GAMMA);
  const [n, setN] = useState(DEFAULT_N);
  const [world, setWorld] = useState<World>(DEFAULT_WORLD);
  const [policy, setPolicy] = useState<Policy>(DEFAULT_POLICY);
  const [seed, setSeed] = useState(DEFAULT_SEED);
  const [showPolicy, setShowPolicy] = useState(true);
  const [showTrue, setShowTrue] = useState(false);
  const [showLog, setShowLog] = useState(true);
  const [showChart, setShowChart] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [savedRuns, setSavedRuns] = useState<ChartLine[]>([]);
  const runIdRef = useRef(0);

  const config: SimConfig = useMemo(
    () => ({ world, policy, method, alpha, gamma, n, seed }),
    [world, policy, method, alpha, gamma, n, seed],
  );
  const simRef = useRef<SimState>(createSim(config));
  const animRef = useRef<Anim>({ fromCell: world.start, toCell: world.start, progress: 1 });
  const [, forceTick] = useState(0);
  const rerender = useCallback(() => forceTick((t) => t + 1), []);

  const vTrue = useMemo(() => solveV(world, policy, gamma), [world, policy, gamma]);
  const states = useMemo(() => reachableStates(world, policy), [world, policy]);
  const stateLabels = useMemo(
    () => states.map((s) => `r${Math.floor(s / world.cols)}c${s % world.cols}`),
    [states, world.cols],
  );
  const maxAbs = useMemo(
    () => Math.max(1, ...vTrue.map((x) => Math.abs(x))),
    [vTrue],
  );

  const snapshotRun = useCallback(
    (sim: SimState) => {
      if (sim.pointer === 0) return;
      const series = errorSeries(sim, vTrue, states);
      if (series.length < 2) return; // no completed episode
      const id = runIdRef.current++;
      setSavedRuns((prev) => [
        ...prev,
        {
          label: `Run ${id + 1} · ${METHOD_LABELS[sim.config.method]}`,
          color: RUN_COLORS[id % RUN_COLORS.length],
          series,
        },
      ]);
    },
    [vTrue, states],
  );

  // auto-reset on any config change (method / params / policy / world / seed)
  useEffect(() => {
    snapshotRun(simRef.current);
    simRef.current = createSim(config);
    animRef.current = { fromCell: config.world.start, toCell: config.world.start, progress: 1 };
    setLog([]);
    setIsPlaying(false);
    rerender();
    // snapshotRun intentionally omitted: it closes over the PREVIOUS vTrue/states,
    // which is what we want when snapshotting the run we are about to discard.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config, rerender]);

  const derived = derive(simRef.current);

  const liveRun: ChartLine | null = useMemo(() => {
    if (simRef.current.pointer === 0) return null;
    const series = errorSeries(simRef.current, vTrue, states);
    if (series.length < 2) return null;
    return { label: `${METHOD_LABELS[method]} (current)`, color: PALETTE.accent, series };
  }, [vTrue, states, method, derived.episode]);

  const chartLines: ChartLine[] = liveRun ? [...savedRuns, liveRun] : savedRuns;

  const commitStep = useCallback(() => {
    const { state, record } = stepForward(simRef.current);
    simRef.current = state;
    animRef.current = { fromCell: record.state, toCell: record.nextState, progress: 0 };
    setLog((l) => [
      ...l,
      `Step ${state.pointer} · ${stepSummary(record.reward, record.done)}`,
    ]);
    rerender();
  }, [rerender]);

  const handleEpisode = useCallback(() => {
    setIsPlaying(false);
    simRef.current = runEpisode(simRef.current);
    animRef.current = {
      fromCell: world.start,
      toCell: currentCell(simRef.current),
      progress: 1,
    };
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

  // animation + auto-step loop
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
      } else if (isPlaying) {
        commitStep();
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
  }, [speed, isPlaying, commitStep, world, policy, showPolicy, maxAbs]);

  // Close the settings dialog on Escape.
  useEffect(() => {
    if (!showSettings) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowSettings(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showSettings]);

  return (
    <div className="mx-auto max-w-[1200px] p-4">
      <p>
        <Link to="/">← All demos</Link>
      </p>
      <h1 className="text-[16px]">Grid World: Policy Evaluation</h1>

      <MethodTabs value={method} onChange={setMethod} />

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

      {showPolicy && (
        <p className="mb-2 text-[10px] text-accent">
          Click a cell to change its action (→ ↓ ← ↑).
        </p>
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
              />
              <button onClick={handleEpisode} aria-label="Run one episode">
                Episode ▶▶
              </button>
            </div>
            <SpeedSelector value={speed} onChange={setSpeed} />
          </div>
        </div>
        {showChart && (
          <div className="min-w-0 shrink basis-[320px]">
            <ConvergenceChart lines={chartLines} />
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

- [ ] **Step 4: Run the test and the typecheck**

Run: `pnpm exec vitest run src/examples/grid-world/__tests__/GridWorldExample.test.tsx`
Expected: PASS (jsdom drives the rAF loop; the Episode button advances the counter).

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/examples/grid-world/GridWorldExample.tsx src/examples/grid-world/__tests__/GridWorldExample.test.tsx
git commit -m "feat: grid-world page with policy editor, step/episode controls, chart"
```

---

## Task 11: Route + landing card

**Files:**
- Modify: `src/main.tsx` (add route)
- Modify: `src/pages/Landing.tsx` (add `EXAMPLES` card)

**Interfaces:**
- Consumes: `GridWorldExample` from `./examples/grid-world/GridWorldExample`.
- Produces: a `/grid-world` route and a landing-page link.

- [ ] **Step 1: Add the route**

In `src/main.tsx`, add the import and route entry:

```tsx
import { GridWorldExample } from "./examples/grid-world/GridWorldExample";
```

```tsx
const router = createBrowserRouter([
  { path: "/", element: <Landing /> },
  { path: "/multi-armed-bandit", element: <BanditExample /> },
  { path: "/grid-world", element: <GridWorldExample /> },
]);
```

- [ ] **Step 2: Add the landing card**

In `src/pages/Landing.tsx`, append to the `EXAMPLES` array:

```tsx
  {
    path: "/grid-world",
    title: "Grid World — Policy Evaluation",
    blurb:
      "Help a character reach Chez Claudette. Estimate V(s) for a fixed policy with Monte Carlo, TD(0), and n-step TD.",
  },
```

- [ ] **Step 3: Verify routing builds and the landing link renders**

Run: `pnpm typecheck`
Expected: PASS.

Run: `pnpm exec vitest run`
Expected: PASS (full suite).

- [ ] **Step 4: Manual smoke check**

Run: `pnpm dev`, open `http://localhost:5173`, click the new card, confirm the grid renders, Step/Episode advance, the heatmap fills in, "Show policy" arrows appear and clicking a cell changes one. Stop the dev server.

- [ ] **Step 5: Commit**

```bash
git add src/main.tsx src/pages/Landing.tsx
git commit -m "feat: route and landing card for the grid-world demo"
```

---

## Task 12: Documentation

**Files:**
- Modify: `README.md`
- Modify: `AGENTS.md`

**Interfaces:** none (docs only).

- [ ] **Step 1: Update README**

Add a section after the bandit section in `README.md`:

```markdown
## Second demo: Grid World — Policy Evaluation

Guide a character across town to **Chez Claudette**, dodging a road (accident risk
off the crosswalk) and a manhole, grabbing a poutine on the way. The policy is fixed
but **editable** — toggle "Show policy" and click cells to change the arrows. Watch the
state-value function `V(s)` get estimated three ways and converge to the exact analytical
values:

- **Monte Carlo** — update from full episode returns at episode end (no bootstrapping).
- **TD(0)** — update every step, bootstrapping on the next state's estimate.
- **n-step TD** — `n` real rewards then bootstrap; `n=1` is TD(0), large `n` approaches MC.
```

- [ ] **Step 2: Update AGENTS.md**

Under "Where to look", add to the `src/shared/rl/` list:

```markdown
  - `gridworld.ts` — grid MDP: cell/action/policy types, `step` (sampled),
    `expectedReward`, `reachableStates`, `solveV` (analytical V via iterative policy
    evaluation).
  - `td-estimators.ts` — MC / TD(0) / n-step policy-evaluation updates
    (`computeValues`) + `rmsError`. Pure functions over a `Transition[]`.
```

And add a new example block:

```markdown
- `src/examples/grid-world/`:
  - `world.ts` — default ASCII map, default policy, constants.
  - `simulation.ts` — trajectory state machine; `derive` recomputes `V(s)` from the
    trajectory prefix so MC/n-step delayed updates rewind correctly. **Start here.**
  - `scene.ts` — grid layout math (`computeGridLayout`, `cellRect`, `cellAtPoint`,
    `heatColor`) + `drawScene` (heatmap, character, policy arrows).
  - `MethodTabs.tsx` / `StateValueTable.tsx` / `ConvergenceChart.tsx` — UI pieces.
  - `GridWorldExample.tsx` — page composition + rAF loop + policy editor (click to edit).
```

Add to the simulation-model / conventions notes:

```markdown
- The grid world evaluates a **fixed but editable deterministic policy** (`Policy` =
  action per cell, plain data). `solveV` gives exact ground-truth `V(s)`; the estimators
  converge toward it. The policy-as-data design is intended to support a future
  policy-iteration (control) demo that reuses the same world, stepper, and solver.
```

- [ ] **Step 3: Verify the docs reference real files**

Run: `pnpm exec vitest run` and `pnpm typecheck`
Expected: PASS (no code changed, but confirms a clean tree before the final commit).

- [ ] **Step 4: Commit**

```bash
git add README.md AGENTS.md
git commit -m "docs: document the grid-world policy-evaluation demo"
```

---

## Final verification

- [ ] Run the full suite: `pnpm exec vitest run` → all green.
- [ ] Typecheck: `pnpm typecheck` → no errors.
- [ ] Production build: `pnpm build` → succeeds.
- [ ] Manual: `pnpm dev`, exercise MC / TD(0) / n-step, Step + Episode, rewind, Reset, "Show policy" editing, settings sliders (α, γ, n), and confirm the heatmap and convergence chart respond and the estimates approach the true values (toggle "Show true value").
