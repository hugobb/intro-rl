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
| PM       | pnpm                                            |

## Where to look

- `src/shared/rl/` — **pure** RL logic, no React/DOM:
  - `rng.ts` — seeded mulberry32 PRNG (`createRng`).
  - `estimator.ts` — incremental sample-average estimates (`Q ← Q + (1/n)(R − Q)`).
  - `reward.ts` — categorical reward sampling + `trueMean`.
  - `policies.ts` — `selectArm` for random/greedy/optimistic/epsilon-greedy.
- `src/examples/multi-armed-bandit/`:
  - `simulation.ts` — trajectory state machine (step/rewind/replay). **Start here** for sim logic.
  - `scene.ts` — canvas layout math (`computeLayout`, `characterX`) + `drawScene` renderer.
  - `restaurants.ts` — default data and constants.
  - `BanditExample.tsx` — page composition + `requestAnimationFrame` loop.
- `src/shared/ui/` — reusable React widgets (tabs, controls, trackers, settings).
- `src/shared/pixel/` — palette + DPR-aware canvas sizing.

## Simulation model

- Reward = categorical distribution over {1★,2★,3★} per restaurant; `trueMean` is the target.
- Estimates use sample averages. Optimistic init only changes the **initial** Q value
  (selection logic is identical to greedy).
- **Trajectory + seeded RNG** powers step/rewind/replay: `pointer` indexes applied steps;
  forward at the tip generates a new record (advancing the RNG), forward after a rewind
  **replays** the stored record without touching the RNG. Same seed ⇒ identical run.

## Conventions

- TypeScript strict; explicit exported types; no `any`.
- `src/shared/rl/` is pure — no React, DOM, or canvas imports.
- Rendering is isolated in `scene.ts` `drawScene` and `src/shared/pixel/`. Pure math
  helpers (e.g. `characterX`, `computeLayout`, `fitCanvas`) are unit-tested; renderers are not.
- Tests are co-located in `__tests__/` next to the code.

## Adding an example

New folder under `src/examples/`, add a route in `src/main.tsx`, add a card in
`src/pages/Landing.tsx`. Reuse `src/shared/*`.

## Gotchas

- Changing policy / ε / init value / distributions **auto-resets** the simulation
  (see the `config` effect in `BanditExample.tsx`).
- The RNG is mutable and stored in `SimState`; it advances only when generating new
  records at the tip — don't reorder forward/replay logic in `stepForward`.
