import { describe, it, expect } from "vitest";
import { createEstimates, updateEstimate } from "../estimator";

describe("estimator", () => {
  it("initializes q to initValue and counts to 0", () => {
    const est = createEstimates(3, 4);
    expect(est.q).toEqual([4, 4, 4]);
    expect(est.counts).toEqual([0, 0, 0]);
  });

  it("first update sets q to the reward (sample average)", () => {
    let est = createEstimates(3, 0);
    est = updateEstimate(est, 1, 3);
    expect(est.q[1]).toBe(3);
    expect(est.counts[1]).toBe(1);
  });

  it("converges to the running mean", () => {
    let est = createEstimates(1, 0);
    for (const r of [1, 2, 3]) est = updateEstimate(est, 0, r);
    expect(est.q[0]).toBeCloseTo(2, 10);
    expect(est.counts[0]).toBe(3);
  });

  it("does not mutate the input", () => {
    const est = createEstimates(2, 0);
    const next = updateEstimate(est, 0, 3);
    expect(est.q[0]).toBe(0);
    expect(est.counts[0]).toBe(0);
    expect(next).not.toBe(est);
  });

  it("treats the init value as a prior observation when priorCount > 0 (optimistic init)", () => {
    let est = createEstimates(1, 4, 1);
    est = updateEstimate(est, 0, 2);
    // init value (4) is the first value in the average, not overwritten: (4 + 2) / 2
    expect(est.q[0]).toBeCloseTo(3, 10);
    expect(est.counts[0]).toBe(1); // real visit count, unaffected by priorCount
    est = updateEstimate(est, 0, 2);
    expect(est.q[0]).toBeCloseTo(8 / 3, 10); // (4 + 2 + 2) / 3
    expect(est.counts[0]).toBe(2);
  });

  it("with priorCount 0, the first observation replaces the init value", () => {
    let est = createEstimates(1, 4, 0);
    est = updateEstimate(est, 0, 2);
    expect(est.q[0]).toBe(2);
  });
});
