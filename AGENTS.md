# Intro RL — Agent Context

## Project

Interactive Reinforcement Learning demos for a lecture. Client-side only; no backend.
First example: a multi-armed bandit ("best poutine in Montréal").

## Tech Stack

| Layer    | Tech                                            |
| -------- | ----------------------------------------------- |
| Build    | Vite                                            |
| UI       | React 19 + TypeScript (strict)                  |
| Routing  | React Router                                    |
| Animation| Plain `<canvas>` 2D pixel art (no game engine)  |
| Tests    | Vitest + jsdom + @testing-library/react         |
| Font     | @fontsource/press-start-2p                      |
| Styling  | Tailwind CSS v4 (`@tailwindcss/vite`); palette + pixel font as `@theme` tokens in `src/styles.css` |
| PM       | pnpm                                            |

## Where to look

- `src/shared/rl/` — **pure** RL logic, no React/DOM:
  - `rng.ts` — seeded mulberry32 PRNG (`createRng`).
  - `estimator.ts` — incremental sample-average estimates (`Q ← Q + (1/n)(R − Q)`).
  - `reward.ts` — categorical reward sampling + `trueMean`.
  - `policies.ts` — `selectArm` / `selectArmWithReason` (reports explore vs exploit) for random/greedy/optimistic/epsilon-greedy.
  - `gridworld.ts` — grid MDP: cell/action/policy types, `step` (sampled),
    `expectedReward`, `reachableStates`, `solveV` (analytical V via iterative policy
    evaluation), `solveV(…, epsilon)` for ε-soft policies, `computeQ` for state-action values,
    `allStates` for metrics over all grid states.
  - `td-estimators.ts` — MC / TD(0) / n-step policy-evaluation updates
    (`computeValues`) + `rmsError`. Pure functions over a `Transition[]`.
- `src/examples/multi-armed-bandit/`:
  - `simulation.ts` — trajectory state machine (step/rewind/replay). **Start here** for sim logic.
  - `scene.ts` — canvas layout math (`computeLayout`, `characterX`) + `drawScene` renderer.
  - `restaurants.ts` — default data and constants.
  - `BanditExample.tsx` — page composition + `requestAnimationFrame` loop.
- `src/examples/grid-world/`:
  - `world.ts` — default ASCII map, default policy, constants.
  - `simulation.ts` — trajectory state machine; `derive` recomputes `V(s)` from the
    trajectory prefix so MC/n-step delayed updates rewind correctly. Now supports ε-soft
    stepping via `policyType` and `epsilon` config, manual `chooseAction`, and helpers
    `visitedStates` / `episodeReturn` for tracking. **Start here.**
  - `scene.ts` — grid layout math (`computeGridLayout`, `cellRect`, `cellAtPoint`,
    `heatColor`) + `drawScene` (heatmap, character, policy arrows). Renders cell sprites
    (road, crosswalk, manhole, poutine, restaurant), Q-value quadrants (`cellQuadrant`),
    and hazard/reward visual effects.
  - `ValueViewTabs.tsx` / `PolicyTypeTabs.tsx` / `ControlModeTabs.tsx` / `ReturnTracker.tsx` — toggle V/Q view, ε-soft vs deterministic, auto/manual mode, and floating return count.
  - `MethodTabs.tsx` / `StateValueTable.tsx` / `ConvergenceChart.tsx` — estimation method selector, state values table, convergence metrics (greedy path / visited states / all states).
  - `GridWorldExample.tsx` — page composition + rAF loop + policy editor (click to edit).
- `src/shared/ui/` — reusable React widgets (tabs, controls, trackers, settings, event log).
  - `chart.ts` — chart data model (`RunData`) + metrics (`metricSeries`: total-reward / optimal-pct) + scaling math.
  - `RewardChart.tsx` — multi-run cumulative chart with a metric selector and a select/delete legend.
- `src/shared/pixel/` — palette + DPR-aware canvas **backing-store** sizing (`fitCanvas`; display size is left to CSS).

## Simulation model

- Reward = categorical distribution over {1★,2★,3★} per restaurant; `trueMean` is the target.
- Estimates use sample averages with an optional `priorCount`. Optimistic init sets a high
  initial Q **and** `priorCount = 1`, so the init value counts as the first sample in the average
  (it isn't overwritten by the first observation); selection logic is identical to greedy.
- Each step records why the arm was chosen (`reason`: explore vs exploit), surfaced in the event log.
- **Trajectory + seeded RNG** powers step/rewind/replay: `pointer` indexes applied steps;
  forward at the tip generates a new record (advancing the RNG), forward after a rewind
  **replays** the stored record without touching the RNG. Same seed ⇒ identical run.

## Conventions

- TypeScript strict; explicit exported types; no `any`.
- `src/shared/rl/` is pure — no React, DOM, or canvas imports.
- Rendering is isolated in `scene.ts` `drawScene` and `src/shared/pixel/`. Pure math
  helpers (e.g. `characterX`, `computeLayout`, `fitCanvas`) are unit-tested; renderers are not.
- Styling is Tailwind utility classes; the palette + pixel font are `@theme` tokens in
  `src/styles.css` (`bg-bg`, `text-ink`, `font-pixel`, …). Base element styles live in `@layer base`.
- Tests are co-located in `__tests__/` next to the code.
- The grid world evaluates a **fixed but editable deterministic policy** (`Policy` =
  action per cell, plain data). `solveV` gives exact ground-truth `V(s)`; the estimators
  converge toward it. The policy-as-data design is intended to support a future
  policy-iteration (control) demo that reuses the same world, stepper, and solver.

## Adding an example

New folder under `src/examples/`, add a route in `src/main.tsx`, add a card in
`src/pages/Landing.tsx`. Reuse `src/shared/*`.

## Gotchas

- Changing policy / ε / init value / distributions **auto-resets** the simulation
  (see the `config` effect in `BanditExample.tsx`).
- The RNG is mutable and stored in `SimState`; it advances only when generating new
  records at the tip — don't reorder forward/replay logic in `stepForward`.
- **Reset rerolls the seed** (each run differs); switching policy/params keeps the current seed so
  policies compare on identical luck. Seed is React state in `BanditExample` (auto-reset effect).
- The reward chart auto-saves a run on reset/policy-change; the live run grows as you step.
