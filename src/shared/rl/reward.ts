import type { RNG } from "./rng";

/** Probabilities of [1★, 2★, 3★]; should sum to 1. */
export type Categorical = [number, number, number];

export function sampleRating(dist: Categorical, rng: RNG): 1 | 2 | 3 {
  const r = rng.next();
  if (r < dist[0]) return 1;
  if (r < dist[0] + dist[1]) return 2;
  return 3;
}

export function trueMean(dist: Categorical): number {
  return 1 * dist[0] + 2 * dist[1] + 3 * dist[2];
}
