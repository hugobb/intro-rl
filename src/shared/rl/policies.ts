import type { RNG } from "./rng";
import type { Estimates } from "./estimator";

export type PolicyKind = "random" | "greedy" | "optimistic" | "epsilon-greedy";

/** Argmax with uniform random tie-breaking among the maxima. */
export function argmaxRandomTie(values: number[], rng: RNG): number {
  let best = -Infinity;
  let ties: number[] = [];
  for (let i = 0; i < values.length; i++) {
    if (values[i] > best) {
      best = values[i];
      ties = [i];
    } else if (values[i] === best) {
      ties.push(i);
    }
  }
  return ties[rng.int(ties.length)];
}

export function selectArm(
  kind: PolicyKind,
  est: Estimates,
  epsilon: number,
  rng: RNG,
): number {
  const n = est.q.length;
  if (kind === "random") return rng.int(n);
  if (kind === "epsilon-greedy") {
    if (rng.next() < epsilon) return rng.int(n);
    return argmaxRandomTie(est.q, rng);
  }
  // greedy and optimistic share selection logic
  return argmaxRandomTie(est.q, rng);
}
