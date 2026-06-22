# Intro to Reinforcement Learning — Interactive Demos

Small, self-contained web app of interactive demos used in an RL lecture. Each demo
illustrates one concept live, with step-by-step and auto-run playback.

## First demo: Multi-Armed Bandit

Find the best poutine in Montréal (Chez Claudette > La Banquise > Poutineville).
Ratings are stochastic (1–3★). Switch between four action-selection policies and watch
the value estimates evolve:

- **Random** — picks uniformly; estimates converge but we never exploit.
- **Greedy** — always picks the current best estimate; can get trapped on a worse
  restaurant after an unlucky start.
- **Optimistic Init** — high initial estimates force early exploration (init value
  editable).
- **ε-Greedy** — exploits the best estimate, explores with probability ε (editable).

## Second demo: Grid World — Policy Evaluation

Guide a character across town to **Chez Claudette**, dodging a road (accident risk
off the crosswalk) and a manhole, grabbing a poutine on the way. The policy is fixed
but **editable** — toggle "Show policy" and click cells to change the arrows. Watch the
state-value function `V(s)` get estimated three ways and converge to the exact analytical
values:

- **Monte Carlo** — update from full episode returns at episode end (no bootstrapping).
- **TD(0)** — update every step, bootstrapping on the next state's estimate.
- **n-step TD** — `n` real rewards then bootstrap; `n=1` is TD(0), large `n` approaches MC.

## Quickstart

```bash
pnpm install
pnpm dev        # http://localhost:5173
pnpm build      # static production build in dist/
pnpm test       # run unit tests (vitest)
```

## Project structure

- `src/shared/rl/` — pure RL logic (RNG, estimator, reward model, policies).
- `src/shared/ui/` — reusable React UI (controls, tabs, trackers, settings).
- `src/shared/pixel/` — palette + canvas helpers for the 8-bit look.
- `src/examples/<name>/` — one folder per demo (`simulation.ts`, `scene.ts`, page component).
- `src/pages/Landing.tsx` — demo index.
- Styling: **Tailwind CSS v4** (utility classes; retro palette + pixel font as `@theme` tokens in `src/styles.css`).

## Adding a new example

1. Create `src/examples/<name>/` with its `simulation.ts`, `scene.ts`, and `<Name>Example.tsx`.
2. Add a route in `src/main.tsx`.
3. Add a card to `EXAMPLES` in `src/pages/Landing.tsx`.

See `AGENTS.md` for deeper architecture notes.
