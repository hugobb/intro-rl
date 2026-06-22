// src/shared/rl/td-estimators.ts
export type Method = "mc" | "td0" | "nstep";

export interface Transition {
  state: number;
  reward: number;
  nextState: number;
  done: boolean;
}

export interface EvalParams {
  method: Method;
  alpha: number;
  gamma: number;
  n: number; // window length for n-step (ignored otherwise)
  numStates: number;
}

/**
 * Derive V(s) by replaying the chosen estimator over `transitions` from a
 * zero-initialized value function. Pure: the same input always yields the same
 * output, which is what makes step/rewind/replay correct for the delayed
 * (MC / n-step) updates — there is no in-place state to un-wind.
 */
export function computeValues(transitions: Transition[], p: EvalParams): number[] {
  const V = new Array<number>(p.numStates).fill(0);
  if (p.method === "td0") return applyTd0(V, transitions, p);
  if (p.method === "mc") return applyMc(V, transitions, p);
  return applyNStep(V, transitions, p);
}

function applyTd0(V: number[], trans: Transition[], p: EvalParams): number[] {
  for (const t of trans) {
    const target = t.reward + p.gamma * (t.done ? 0 : V[t.nextState]);
    V[t.state] += p.alpha * (target - V[t.state]);
  }
  return V;
}

function applyMc(V: number[], trans: Transition[], p: EvalParams): number[] {
  let ep: Transition[] = [];
  for (const t of trans) {
    ep.push(t);
    if (!t.done) continue;
    // Episode complete: compute returns backward, then every-visit update.
    let G = 0;
    const returns = new Array<number>(ep.length);
    for (let i = ep.length - 1; i >= 0; i--) {
      G = ep[i].reward + p.gamma * G;
      returns[i] = G;
    }
    for (let i = 0; i < ep.length; i++) {
      const s = ep[i].state;
      V[s] += p.alpha * (returns[i] - V[s]);
    }
    ep = [];
  }
  // A trailing incomplete episode contributes no updates (MC waits for the end).
  return V;
}

// n-step implementation lands in Task 4; throw until then so an accidental
// "nstep" call fails loudly rather than silently returning zeros.
function applyNStep(_V: number[], _trans: Transition[], _p: EvalParams): number[] {
  throw new Error("n-step estimator not implemented yet");
}

/** RMS error of `vEst` vs `vTrue` over the given state indices. */
export function rmsError(
  vEst: number[],
  vTrue: number[],
  states: number[],
): number {
  if (states.length === 0) return 0;
  let sum = 0;
  for (const s of states) {
    const d = vEst[s] - vTrue[s];
    sum += d * d;
  }
  return Math.sqrt(sum / states.length);
}
