export interface Estimates {
  q: number[];
  counts: number[];
  /**
   * Pseudo-count for the initial value — the weight the init value carries as a
   * prior "observation" in the running average. 0 = standard sample average (the
   * init value is discarded on the first observation). 1 = the init value counts
   * as the first value in the average (used by optimistic initialization, so the
   * optimism persists and a single noisy first rating can't define the estimate).
   */
  priorCount: number;
}

export function createEstimates(
  numArms: number,
  initValue: number,
  priorCount = 0,
): Estimates {
  return {
    q: Array<number>(numArms).fill(initValue),
    counts: Array<number>(numArms).fill(0),
    priorCount,
  };
}

/**
 * Immutable incremental sample-average update:
 * Q ← Q + (1 / (n + priorCount))(R − Q), where n is the post-increment visit count.
 * `counts` tracks real visits (for display); `priorCount` only widens the averaging
 * denominator, so a non-zero prior keeps the init value in the average instead of
 * letting the first observation overwrite it.
 */
export function updateEstimate(est: Estimates, arm: number, reward: number): Estimates {
  const q = est.q.slice();
  const counts = est.counts.slice();
  counts[arm] += 1;
  const effectiveCount = counts[arm] + est.priorCount;
  q[arm] = q[arm] + (1 / effectiveCount) * (reward - q[arm]);
  return { q, counts, priorCount: est.priorCount };
}
