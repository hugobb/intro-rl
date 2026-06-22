export interface Estimates {
  q: number[];
  counts: number[];
}

export function createEstimates(numArms: number, initValue: number): Estimates {
  return {
    q: Array<number>(numArms).fill(initValue),
    counts: Array<number>(numArms).fill(0),
  };
}

/** Immutable incremental sample-average update: Q ← Q + (1/n)(R − Q). */
export function updateEstimate(est: Estimates, arm: number, reward: number): Estimates {
  const q = est.q.slice();
  const counts = est.counts.slice();
  counts[arm] += 1;
  q[arm] = q[arm] + (1 / counts[arm]) * (reward - q[arm]);
  return { q, counts };
}
