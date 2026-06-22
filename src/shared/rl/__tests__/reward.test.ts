import { describe, it, expect } from "vitest";
import { sampleRating, trueMean, type Categorical } from "../reward";
import { createRng } from "../rng";

describe("reward model", () => {
  it("computes the true mean", () => {
    expect(trueMean([0.1, 0.3, 0.6])).toBeCloseTo(2.5, 10);
    expect(trueMean([0.5, 0.3, 0.2])).toBeCloseTo(1.7, 10);
  });

  it("only returns 1, 2, or 3", () => {
    const rng = createRng(3);
    const dist: Categorical = [0.2, 0.4, 0.4];
    for (let i = 0; i < 500; i++) {
      expect([1, 2, 3]).toContain(sampleRating(dist, rng));
    }
  });

  it("empirical mean approaches the true mean", () => {
    const rng = createRng(99);
    const dist: Categorical = [0.1, 0.3, 0.6];
    let sum = 0;
    const n = 20000;
    for (let i = 0; i < n; i++) sum += sampleRating(dist, rng);
    expect(sum / n).toBeCloseTo(trueMean(dist), 1);
  });
});
