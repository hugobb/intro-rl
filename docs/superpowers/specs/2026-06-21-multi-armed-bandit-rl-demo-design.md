# Interactive RL Lecture — Multi-Armed Bandit Demo

**Date:** 2026-06-21
**Status:** Approved design, pending implementation plan

## Purpose

A small, zero-friction interactive web app to teach Reinforcement Learning concepts
to a live lecture audience. The first example illustrates the **multi-armed bandit
problem** through a relatable scenario: finding the best poutine restaurant in
Montréal.

The app must be reliable on stage, easy to extend with future RL examples, and
visually engaging (8-bit / retro arcade aesthetic).

## Pedagogical Narrative

The presenter walks the audience through four action-selection policies in sequence,
each one motivating the next:

1. **Random** — pick a restaurant uniformly at random. Estimates converge to true
   values, but we never exploit what we learn.
2. **Greedy** — always pick the restaurant with the highest current estimate. Shown
   to **fail**: an unlucky early sample can trap it on a suboptimal restaurant
   because it never explores.
3. **Optimistic Initialization** — start all estimates high (init value editable by
   the user). Under correct assumptions this forces early exploration and converges
   to the best restaurant.
4. **ε-Greedy** — exploit the best estimate most of the time, explore randomly with
   probability ε (editable by the user).

## Scenario & Reward Model

Three restaurants, in true quality order:

> **Chez Claudette > La Banquise > Poutineville**

Each visit yields a stochastic rating of **1★, 2★, or 3★**, drawn from a
**categorical distribution** per restaurant. Defaults (chosen so the means are close
enough that greedy can plausibly fail):

| Restaurant     | P(1★) | P(2★) | P(3★) | True mean |
| -------------- | ----- | ----- | ----- | --------- |
| Chez Claudette | 0.1   | 0.3   | 0.6   | **2.5**   |
| La Banquise    | 0.2   | 0.4   | 0.4   | **2.2**   |
| Poutineville   | 0.5   | 0.3   | 0.2   | **1.7**   |

These distributions are **editable live** via a hidden settings panel (gear button),
so the presenter can widen/narrow the quality gap and show the effect on each policy.

### Estimation

Estimated value per restaurant uses the standard incremental sample-average update:

```
Q_{n+1} = Q_n + (1/n) * (reward - Q_n)
```

For **Optimistic Initialization**, all Q values start at the user-set init value
(default chosen above the max possible reward, e.g. 4 or 5) rather than 0.

## Tech Stack & Project Structure

- **Package manager:** pnpm
- **Build/dev:** Vite (fast dev server, static production build, ES modules)
- **UI:** React + TypeScript
- **Routing:** React Router (landing page + one route per example)
- **Animation:** plain HTML `<canvas>` 2D with hand-rolled pixel art driven by
  `requestAnimationFrame`. **No game engine** (Kaplay/Phaser rejected as overkill).

Rationale: pnpm + Vite gives proper dependency management and a static build that
deploys/opens anywhere, while keeping the bundle tiny and the simulation logic
transparent (nice when showing code in a lecture). React handles the reactive UI
(trackers, sliders, tabs); canvas handles the game-like animation.

```
intro-rl/
├── package.json
├── vite.config.ts
├── index.html                       # entry → landing page
├── src/
│   ├── main.tsx                     # React Router setup
│   ├── pages/
│   │   └── Landing.tsx              # grid of available examples
│   ├── shared/                      # reused across all examples
│   │   ├── ui/                      # control bar, play/step/reset, speed selector,
│   │   │                            #   value-bar tracker, count tracker, settings panel
│   │   ├── pixel/                   # 8-bit rendering helpers: palette, sprite drawing,
│   │   │                            #   font loading, canvas scaling
│   │   └── rl/                      # reusable RL primitives:
│   │       ├── rng.ts               #   seeded RNG (deterministic, reproducible)
│   │       ├── policies.ts          #   random / greedy / optimistic / epsilon-greedy
│   │       └── estimator.ts         #   incremental sample-average estimates
│   └── examples/
│       └── multi-armed-bandit/
│           ├── BanditExample.tsx    # page composition (route component)
│           ├── simulation.ts        # trajectory-based bandit simulation state machine
│           └── scene.ts             # canvas pixel-art scene (street, storefronts, character)
└── docs/
```

Adding a future example = new folder under `src/examples/` + a route + a card on the
landing page. Shared code in `src/shared/` is reused.

## Simulation Engine

The simulation is a **trajectory-based state machine** to support step-forward,
step-back/rewind, and replay:

- A **seeded RNG** makes every run reproducible. Reset can reuse the same seed for
  repeatable demos.
- The simulation records a **trajectory**: an ordered list of steps, each
  `{ restaurantIndex, rating }`, with a **pointer** into the list (the current step).
- **Step forward:** if the pointer is behind the tip (we've rewound), replay the
  recorded event; otherwise generate a new event from the policy + RNG and append it.
- **Step back / rewind:** move the pointer back one step and restore the prior
  estimates and visit counts. (Recompute from the trajectory prefix, or restore from
  a per-step snapshot.)
- **Derived state** at any pointer position: per-restaurant Q estimates, per-restaurant
  visit counts, total step count.

Policy choice and parameters (ε, optimistic init value, true distributions) are inputs
to event *generation*. Changing any of them **auto-resets** the trajectory (the old
trajectory is no longer valid under new parameters).

## UI Layout

Single screen for the bandit example:

1. **Policy tabs** (segmented control): Random | Greedy | Optimistic Init | ε-Greedy.
   Switching tabs auto-resets. The active policy's parameter appears contextually in
   the control bar (init-value field for Optimistic; ε field for ε-Greedy).
2. **Animation scene** (canvas): a horizontal pixel-art street with the three labeled
   storefronts. A pixel character walks from a central spot to the chosen restaurant,
   a star rating (1–3★) pops above it, the corresponding tracker updates, then it walks
   back. Retro palette, `image-rendering: pixelated`, "Press Start 2P" font.
3. **Control bar:** Step ◀ (rewind one), Step ▶ (advance one), Play/Pause (auto-run),
   Reset (manual). Speed as discrete options: **0.5×, 1×, 2×, 5×, 10×, 25×, 50×**.
   At higher speeds the walk animation simply plays faster (no snapping/teleporting).
4. **Trackers panel:**
   - Three **estimated-value bars** (one per restaurant), updating live.
   - **Visit count** per restaurant.
   - **True-value overlay** marker on each bar — toggleable (hide for suspense, show
     to reveal convergence).
   - **Step counter** (total visits so far).
5. **Event-log panel:** hidden by default; toggle to open a scrolling log
   ("Step 12: visited La Banquise → 3★").
6. **Settings panel:** hidden behind a gear button; edit the true categorical
   distributions live.

### Reset behavior

- **Auto-reset** when: switching policy tab, or changing ε / optimistic init value /
  true distributions.
- **Manual reset** via the Reset button at any other time.

## Behavior at High Speed

The speed multiplier controls how quickly steps advance. The walk animation keeps
playing, just faster, at every speed (per explicit request — no snapping). At extreme
multipliers the walk becomes near-instant but is still rendered.

## Out of Scope (YAGNI)

- No backend, no persistence, no accounts — fully client-side.
- No game engine.
- No "all four policies racing side-by-side" view in this example (candidate for a
  *future* comparison example, not v1).
- No additional RL examples in this spec — the structure supports them, but each future
  example gets its own spec → plan → implementation cycle.

## Success Criteria

- Presenter can, live and reliably: select each policy, step through visit-by-visit,
  let it auto-run at a chosen speed, rewind, and reset.
- Greedy visibly fails (gets trapped) at least sometimes with default distributions;
  optimistic init and ε-greedy visibly converge to Chez Claudette.
- Estimated-value bars visibly converge toward the true-value markers when revealed.
- The 8-bit animation clearly communicates *which* restaurant was visited and *what
  rating* it gave on each step.
- Zero build-time surprises on stage: `pnpm dev` runs locally; `pnpm build` produces a
  static deployable bundle.
