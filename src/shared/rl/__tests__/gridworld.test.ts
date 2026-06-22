// src/shared/rl/__tests__/gridworld.test.ts
import { describe, it, expect } from "vitest";
import { createRng } from "@/shared/rl/rng";
import {
  nextCell,
  step,
  expectedReward,
  isTerminal,
  reachableStates,
  solveV,
  type World,
  type Policy,
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

describe("step / expectedReward when bumping a wall or edge", () => {
  // 1x2 world: [start(0), road(1)]; road has accident prob x1=1 so entry would always yield -r1=-4
  function wallBumpWorld(): World {
    return {
      rows: 1,
      cols: 2,
      cells: ["start", "road"],
      start: 0,
      reward: { x1: 1, x2: 0, r1: 4, r2: 0, r3: 0, r4: 0, stepCost: 0 },
    };
  }

  it("step: no entry reward when bumping the right edge (next === cell)", () => {
    // cell 1 is at the right edge; moving right stays at 1 → no entry, reward must be 0
    const r = step(wallBumpWorld(), 1, "right", createRng(1));
    expect(r.next).toBe(1);
    expect(r.reward).toBe(0); // NOT -4 despite x1=1
  });

  it("expectedReward: 0 when bumping the right edge (not -4)", () => {
    expect(expectedReward(wallBumpWorld(), 1, "right")).toBe(0);
  });

  it("sanity: real entry into road still triggers the hazard reward", () => {
    // cell 0 (start) → right → cell 1 (road): x1=1 so reward must be -r1=-4
    const r = step(wallBumpWorld(), 0, "right", createRng(1));
    expect(r.next).toBe(1);
    expect(r.reward).toBe(-4);
  });
});
