import { describe, it, expect } from "vitest";
import { createRng } from "../rng";

describe("createRng", () => {
  it("is deterministic for the same seed", () => {
    const a = createRng(42);
    const b = createRng(42);
    const seqA = [a.next(), a.next(), a.next()];
    const seqB = [b.next(), b.next(), b.next()];
    expect(seqA).toEqual(seqB);
  });

  it("returns floats in [0,1)", () => {
    const r = createRng(1);
    for (let i = 0; i < 1000; i++) {
      const v = r.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("int(m) returns integers in [0,m)", () => {
    const r = createRng(7);
    for (let i = 0; i < 1000; i++) {
      const v = r.int(3);
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(3);
    }
  });

  it("different seeds produce different sequences", () => {
    expect(createRng(1).next()).not.toBe(createRng(2).next());
  });
});
