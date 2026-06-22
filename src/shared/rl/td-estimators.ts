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

function applyNStep(V: number[], trans: Transition[], p: EvalParams): number[] {
  const n = Math.max(1, Math.floor(p.n));
  let ep: Transition[] = [];
  let applied = 0; // states in the current episode already updated

  // Apply every state whose full n-step window is now available. The bootstrap
  // state after n transitions from tau is ep[tau+n-1].nextState (= terminal at
  // episode end, where V is 0).
  const applyFullWindows = () => {
    while (ep.length >= applied + n) {
      const tau = applied;
      let G = 0;
      for (let k = n - 1; k >= 0; k--) G = ep[tau + k].reward + p.gamma * G;
      const bootCell = ep[tau + n - 1].nextState;
      G += Math.pow(p.gamma, n) * V[bootCell];
      V[ep[tau].state] += p.alpha * (G - V[ep[tau].state]);
      applied += 1;
    }
  };

  for (const t of trans) {
    ep.push(t);
    if (!t.done) {
      applyFullWindows();
      continue;
    }
    // Episode end: close any remaining full windows, then flush the tail states
    // (their windows reach the terminal, so no bootstrap).
    applyFullWindows();
    const L = ep.length;
    for (let tau = applied; tau < L; tau++) {
      let G = 0;
      for (let k = L - 1; k >= tau; k--) G = ep[k].reward + p.gamma * G;
      V[ep[tau].state] += p.alpha * (G - V[ep[tau].state]);
    }
    ep = [];
    applied = 0;
  }
  // Trailing incomplete episode keeps only its already-applied closed windows.
  return V;
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
