import { describe, it, expect } from "vitest";
import { DEFAULT_RESTAURANTS, MAX_VALUE } from "../restaurants";
import { trueMean } from "@/shared/rl/reward";

describe("default restaurants", () => {
  it("are ordered Claudette > Banquise > Poutineville by true mean", () => {
    const [a, b, c] = DEFAULT_RESTAURANTS.map((r) => trueMean(r.dist));
    expect(a).toBeGreaterThan(b);
    expect(b).toBeGreaterThan(c);
  });

  it("has the expected means", () => {
    const means = DEFAULT_RESTAURANTS.map((r) => Number(trueMean(r.dist).toFixed(2)));
    expect(means).toEqual([2.5, 2.2, 1.7]);
  });

  it("max value is 3", () => {
    expect(MAX_VALUE).toBe(3);
  });
});
