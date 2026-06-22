import { createRng, type RNG } from "@/shared/rl/rng";
import { sampleRating, type Categorical } from "@/shared/rl/reward";
import {
  createEstimates,
  updateEstimate,
  type Estimates,
} from "@/shared/rl/estimator";
import {
  selectArmWithReason,
  type PolicyKind,
  type SelectionReason,
} from "@/shared/rl/policies";

export interface Restaurant {
  name: string;
  dist: Categorical;
}

export interface SimConfig {
  restaurants: Restaurant[];
  policy: PolicyKind;
  epsilon: number;
  optimisticInit: number;
  seed: number;
}

export interface StepRecord {
  arm: number;
  reward: number;
  reason: SelectionReason;
}

export interface SimState {
  config: SimConfig;
  trajectory: StepRecord[];
  pointer: number;
  rng: RNG;
}

export interface DerivedState {
  q: number[];
  counts: number[];
  step: number;
}

function initValueFor(config: SimConfig): number {
  return config.policy === "optimistic" ? config.optimisticInit : 0;
}

function priorCountFor(config: SimConfig): number {
  // Optimistic init treats the initial value as one prior observation, so the
  // optimism persists into the running average instead of being overwritten on
  // the first visit. Other policies use a plain sample average (no prior).
  return config.policy === "optimistic" ? 1 : 0;
}

function estimatesAt(state: SimState): Estimates {
  let est = createEstimates(
    state.config.restaurants.length,
    initValueFor(state.config),
    priorCountFor(state.config),
  );
  for (let i = 0; i < state.pointer; i++) {
    const rec = state.trajectory[i];
    est = updateEstimate(est, rec.arm, rec.reward);
  }
  return est;
}

export function createSim(config: SimConfig): SimState {
  return { config, trajectory: [], pointer: 0, rng: createRng(config.seed) };
}

export function derive(state: SimState): DerivedState {
  const est = estimatesAt(state);
  return { q: est.q, counts: est.counts, step: state.pointer };
}

export function stepForward(state: SimState): { state: SimState; record: StepRecord } {
  if (state.pointer < state.trajectory.length) {
    const record = state.trajectory[state.pointer];
    return { state: { ...state, pointer: state.pointer + 1 }, record };
  }
  const est = estimatesAt(state);
  const { arm, reason } = selectArmWithReason(
    state.config.policy,
    est,
    state.config.epsilon,
    state.rng,
  );
  const reward = sampleRating(state.config.restaurants[arm].dist, state.rng);
  const record: StepRecord = { arm, reward, reason };
  return {
    state: {
      ...state,
      trajectory: state.trajectory.concat(record),
      pointer: state.pointer + 1,
    },
    record,
  };
}

export function stepBack(state: SimState): SimState {
  if (state.pointer === 0) return state;
  return { ...state, pointer: state.pointer - 1 };
}

export function reset(state: SimState, seed?: number): SimState {
  const newSeed = seed ?? state.config.seed;
  return {
    config: { ...state.config, seed: newSeed },
    trajectory: [],
    pointer: 0,
    rng: createRng(newSeed),
  };
}

/**
 * Make a manual choice of `arm` at the current pointer (used by manual mode, which
 * has no automated policy): samples a reward for the chosen arm, discards any
 * rewound-future steps, and appends the step with reason "manual".
 */
export function chooseArm(
  state: SimState,
  arm: number,
): { state: SimState; record: StepRecord } {
  const reward = sampleRating(state.config.restaurants[arm].dist, state.rng);
  const record: StepRecord = { arm, reward, reason: "manual" };
  const trajectory = state.trajectory.slice(0, state.pointer).concat(record);
  return {
    state: { ...state, trajectory, pointer: state.pointer + 1 },
    record,
  };
}

/**
 * Cumulative reward over applied steps: returns [0, r1, r1+r2, ...] up to the
 * current pointer. Index = step number; value = total reward earned by that step.
 */
export function cumulativeReward(state: SimState): number[] {
  const out: number[] = [0];
  let sum = 0;
  for (let i = 0; i < state.pointer; i++) {
    sum += state.trajectory[i].reward;
    out.push(sum);
  }
  return out;
}
