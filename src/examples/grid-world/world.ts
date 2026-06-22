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
