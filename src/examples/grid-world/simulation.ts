import { createRng, type RNG } from "@/shared/rl/rng";
import { step, type Policy, type World } from "@/shared/rl/gridworld";
import {
  computeValues,
  rmsError,
  type EvalParams,
  type Method,
  type Transition,
} from "@/shared/rl/td-estimators";

export interface SimConfig {
  world: World;
  policy: Policy;
  method: Method;
  alpha: number;
  gamma: number;
  n: number;
  seed: number;
}

export type StepRecord = Transition;

export interface SimState {
  config: SimConfig;
  trajectory: StepRecord[];
  pointer: number;
  rng: RNG;
}

export interface DerivedState {
  v: number[];
  step: number;
  episode: number;
  current: number;
}

export const MAX_EPISODE_STEPS = 200;

export function createSim(config: SimConfig): SimState {
  return { config, trajectory: [], pointer: 0, rng: createRng(config.seed) };
}

/** Agent cell at the pointer: start, or the last applied step's nextState
 *  (unless that step ended an episode, in which case the next episode restarts). */
export function currentCell(state: SimState): number {
  if (state.pointer === 0) return state.config.world.start;
  const last = state.trajectory[state.pointer - 1];
  return last.done ? state.config.world.start : last.nextState;
}

function episodeStepCount(state: SimState): number {
  let count = 0;
  for (let i = state.pointer - 1; i >= 0; i--) {
    if (state.trajectory[i].done) break;
    count += 1;
  }
  return count;
}

export function stepForward(state: SimState): { state: SimState; record: StepRecord } {
  if (state.pointer < state.trajectory.length) {
    const record = state.trajectory[state.pointer];
    return { state: { ...state, pointer: state.pointer + 1 }, record };
  }
  const cell = currentCell(state);
  const action = state.config.policy[cell];
  const res = step(state.config.world, cell, action, state.rng);
  // Loop guard: truncate runaway episodes (e.g. a hand-edited looping policy) as
  // terminal so MC/n-step can flush their delayed updates and the run stays finite.
  const truncated = episodeStepCount(state) + 1 >= MAX_EPISODE_STEPS;
  const record: StepRecord = {
    state: cell,
    reward: res.reward,
    nextState: res.next,
    done: res.done || truncated,
  };
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

/** Advance until the current episode ends (a done record is applied). */
export function runEpisode(state: SimState): SimState {
  let s = state;
  for (let i = 0; i <= MAX_EPISODE_STEPS; i++) {
    const out = stepForward(s);
    s = out.state;
    if (out.record.done) break;
  }
  return s;
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

function evalParams(config: SimConfig): EvalParams {
  return {
    method: config.method,
    alpha: config.alpha,
    gamma: config.gamma,
    n: config.n,
    numStates: config.world.cells.length,
  };
}

export function derive(state: SimState): DerivedState {
  const applied = state.trajectory.slice(0, state.pointer);
  const v = computeValues(applied, evalParams(state.config));
  let episode = 0;
  for (const t of applied) if (t.done) episode += 1;
  return { v, step: state.pointer, episode, current: currentCell(state) };
}

/** RMS error vs vTrue at each completed-episode boundary (index 0 = initial zeros). */
export function errorSeries(
  state: SimState,
  vTrue: number[],
  states: number[],
): number[] {
  const params = evalParams(state.config);
  const zero = new Array<number>(params.numStates).fill(0);
  const out: number[] = [rmsError(zero, vTrue, states)];
  const prefix: StepRecord[] = [];
  for (let i = 0; i < state.pointer; i++) {
    prefix.push(state.trajectory[i]);
    if (state.trajectory[i].done) {
      out.push(rmsError(computeValues(prefix, params), vTrue, states));
    }
  }
  return out;
}
