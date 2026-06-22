import type { RNG } from "./rng";
import type { Estimates } from "./estimator";

export type PolicyKind =
  | "random"
  | "greedy"
  | "optimistic"
  | "epsilon-greedy"
  | "manual";

/**
 * Why an arm was chosen: a random "explore" pick, the best-estimate "exploit"
 * pick, or a "manual" pick made by the user (manual mode has no automated policy).
 */
export type SelectionReason = "explore" | "exploit" | "manual";

export interface Selection {
  arm: number;
  reason: SelectionReason;
}

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

/**
 * Select an arm and report whether it was an exploratory (random) pick or an
 * exploitative (best-estimate) pick. RNG consumption is identical to selectArm.
 */
export function selectArmWithReason(
  kind: PolicyKind,
  est: Estimates,
  epsilon: number,
  rng: RNG,
): Selection {
  const n = est.q.length;
  if (kind === "random") return { arm: rng.int(n), reason: "explore" };
  if (kind === "epsilon-greedy") {
    if (rng.next() < epsilon) return { arm: rng.int(n), reason: "explore" };
    return { arm: argmaxRandomTie(est.q, rng), reason: "exploit" };
  }
  // greedy and optimistic share selection logic
  return { arm: argmaxRandomTie(est.q, rng), reason: "exploit" };
}

export function selectArm(
  kind: PolicyKind,
  est: Estimates,
  epsilon: number,
  rng: RNG,
): number {
  return selectArmWithReason(kind, est, epsilon, rng).arm;
}
