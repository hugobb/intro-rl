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
  const entryReward = next === cell ? 0 : enterRewardSample(world, next, rng);
  const reward = entryReward - world.reward.stepCost;
  return { next, reward, done: isTerminal(world, next) };
}

/** Expected immediate reward of taking `action` in `cell` (for the analytical solver). */
export function expectedReward(world: World, cell: number, action: Action): number {
  const next = nextCell(world, cell, action);
  const entryReward = next === cell ? 0 : enterRewardExpected(world, next);
  return entryReward - world.reward.stepCost;
}

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
