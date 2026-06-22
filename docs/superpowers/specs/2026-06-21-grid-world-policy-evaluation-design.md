# Interactive RL Lecture — Grid World Policy Evaluation Demo

**Date:** 2026-06-21
**Status:** Approved design, pending implementation plan

## Purpose

A second interactive demo for the RL lecture app, illustrating **policy evaluation** —
estimating the state-value function `V(s)` for a *fixed* policy — and contrasting the
three classic ways to do it:

1. **Monte Carlo (MC)** — estimate `V(s)` from full episode returns (no bootstrapping).
2. **TD(0)** — one-step temporal-difference, bootstrapping on the next state's estimate.
3. **n-step TD** — the bridge between them: `n` real rewards, then bootstrap. `n=1` is
   TD(0); large `n` approaches MC. `n` is adjustable live.

The demo reuses the existing app's architecture (pure RL logic in `src/shared/rl/`,
trajectory + seeded-RNG simulation, canvas pixel-art scene, shared UI widgets) and the
8-bit aesthetic. It must be reliable on stage and easy to extend — in particular, the
**policy is a first-class editable object**, so a future *policy-iteration / control*
demo can reuse the same world, environment stepper, and analytical solver and simply
add a step that overwrites the policy.

## Pedagogical Narrative

A pixel character walks across a small town toward the **Chez Claudette** restaurant.
The presenter:

1. Shows the world and the **fixed policy** (arrows on the grid), then runs episodes.
2. Watches `V(s)` fill in on a per-cell heatmap, comparing how each method propagates
   value:
   - **TD(0)** trickles value backward one cell per visit (bootstrapping) — needs many
     episodes for value to reach the start.
   - **MC** assigns the full return to every visited cell at episode end — value
     "bursts" backward all at once, but with higher variance.
   - **n-step TD** interpolates: sweep `n` from 1 to large and watch the behavior move
     from TD-like to MC-like.
3. Optionally edits the policy live (click cells to change arrows) and re-evaluates,
   showing how routing through hazards lowers `V`.

## Scenario & Reward Model

### The grid

A small board (target **7×6**, exact dimensions finalized in implementation) of typed
cells:

| Cell type        | Behavior on entering                                              |
| ---------------- | ---------------------------------------------------------------- |
| **Empty**        | Walkable, no reward (optional small step cost, default 0).       |
| **Wall/obstacle**| Impassable. An action into a wall (or off the board) = stay put. |
| **Road**         | Off-crosswalk crossing: with prob `x1` → accident, reward `−r1`. |
| **Crosswalk**    | A road cell that is **safe** — no accident roll.                 |
| **Manhole**      | With prob `x2` → fall, reward `−r2`.                             |
| **Poutine**      | Deterministic `+r3` (a reward collected on the way).            |
| **Start**        | Where the character begins each episode.                        |
| **Restaurant**   | Chez Claudette — **terminal**: reward `+r4`, episode ends.      |

The crosswalk is functional scenery: the default policy/path crosses the road
off-crosswalk (incurring `x1` risk), but a presenter editing the policy could route
through the crosswalk to avoid it — illustrating risk vs. distance in the value
function.

### The policy

`π` is a **deterministic action per cell** (`↑ ↓ ← →`), stored as plain data
(`Policy = Map<cellId, Action>` or equivalent). The character's path is **induced** by
following `π` from Start until the terminal cell or a max-step cap (loop guard).
Editing `π` changes the path, the hazards encountered, and therefore `V(s)`.

### Reward & return

- Per-step reward is determined by the **entered** cell (hazard roll, poutine, terminal,
  or step cost).
- Return `Gₜ = Σ γᵏ rₜ₊₁₊ₖ` with discount `γ`.
- **Default `γ < 1`** (e.g. 0.9) so the Bellman system is always solvable even if a
  hand-edited policy contains a loop, and so distance-to-goal matters.

### Editable settings (live, behind a gear panel)

| Setting        | Meaning                                   |
| -------------- | ----------------------------------------- |
| `x1`           | Accident probability (off-crosswalk road) |
| `x2`           | Manhole fall probability                  |
| `r1`           | Accident penalty (applied as `−r1`)       |
| `r2`           | Manhole penalty (applied as `−r2`)        |
| `r3`           | Poutine reward                            |
| `r4`           | Restaurant (terminal) reward              |
| `α`            | Step size for the value update            |
| `γ`            | Discount factor                           |
| `n`            | Window length for n-step TD               |
| Show policy    | Toggle the per-cell action-arrow overlay  |

## Estimation Methods

All three evaluate the **current `π`**. The update is the same shape for all:

```text
V(s) ← V(s) + α · [ target − V(s) ]
```

They differ only in the target and when it is applied:

| Method      | Target                                  | Applied                          |
| ----------- | --------------------------------------- | -------------------------------- |
| **MC**      | full return `Gₜ` to episode end         | at **episode end**, per visited s |
| **TD(0)**   | `rₜ₊₁ + γ·V(sₜ₊₁)`                       | every **step**                   |
| **n-step**  | `Gₜ:ₜ₊ₙ = (Σ γᵏ rₜ₊₁₊ₖ) + γⁿ·V(sₜ₊ₙ)` | when the n-step window closes    |

- **Every-visit** semantics by default (each visit to a state contributes an update);
  first-visit is a possible later refinement, out of scope for v1.
- For terminal/truncated episodes, bootstrapped terms use `V(terminal) = 0`, and the
  n-step target degrades to the available real rewards near episode end (standard
  n-step return handling).

### Analytical ground truth

For any deterministic `π`, the demo computes the **exact** `V(s)` by solving the linear
Bellman system `(I − γP)V = R` directly (the world is small — a handful of reachable
states). This exact `V` is the reference for the convergence chart (real estimation
error, not just "it settled") and recomputes whenever `π`, `γ`, the hazard probs, or the
rewards change.

## Simulation Engine

A **trajectory-based, seeded-RNG state machine** mirroring the bandit's design, to
support step / rewind / replay deterministically:

- A **seeded RNG** makes every run reproducible; reset can reuse or reroll the seed
  (match the bandit's behavior: manual reset rerolls; config changes keep the seed so
  methods compare on identical luck).
- The **trajectory** is an ordered list of environment steps, each recording
  `{ state, action, nextState, reward, episodeDone }`, with a **pointer** to the current
  step.
- **Step forward:** at the tip, generate a new step from `π` + RNG and append; behind the
  tip (after a rewind), replay the recorded step without advancing the RNG.
- **Derived value state:** `V(s)` at any pointer is recomputed by **replaying the applied
  updates over the trajectory prefix** (as the bandit derives estimates via
  `estimatesAt`). This is what makes rewind correct for **MC and n-step**, whose updates
  are *delayed* (applied at episode end / when the window closes) — there is no in-place
  mutation to un-wind; the value function is a pure function of the trajectory prefix +
  method + hyperparameters.
- Changing `π`, the method, or any hyperparameter (`α`, `γ`, `n`, hazard probs, rewards)
  **auto-resets** the trajectory.

### Stepping controls

Two explicit playback granularities (per request), plus continuous auto-run:

- **Step** — advance one *environment* step (one cell move). Makes a single TD bootstrap
  or character move visible.
- **Episode** — run to the end of the current episode. Makes MC's end-of-episode return
  flow back all at once; fast-forwards a full walk.
- **Play/Pause + speed selector** — continuous auto-run (reuse the bandit's
  `PlaybackControls` + `SpeedSelector`).
- **Rewind** — step back one environment step (trajectory pointer − 1).

## Rendering

Canvas scene in `scene.ts` (pure layout math + `drawScene`, matching the bandit
convention — layout math unit-tested, renderer not):

- The **grid** with typed-cell sprites (empty / wall / road / crosswalk / manhole /
  poutine / start / restaurant).
- The **character** at its current cell, animating between cells on each step.
- The **`V(s)` heatmap** — per-cell background color (diverging scale around 0) plus the
  numeric estimate.
- The **policy overlay** — an action arrow on each cell, drawn when "Show policy" is on,
  and the surface for click-to-edit.
- 8-bit palette, `image-rendering: pixelated`, "Press Start 2P" font — consistent with
  the bandit.

### Policy editor

When "Show policy" is on, **clicking a cell cycles its action** (`→ ↓ ← ↑`); the arrow
updates live and the value estimates auto-reset. Hit-testing maps click coordinates to a
cell via the same layout math used for rendering.

## UI Layout

Single screen for the grid-world example:

1. **Method tabs** (segmented control): MC | TD(0) | n-step TD. Switching auto-resets.
   The `n` field appears contextually when n-step is active.
2. **Animation scene** (canvas): the grid, character, `V(s)` heatmap, and (toggleable)
   policy arrows.
3. **Control bar:** Step ▶ (one env step), Episode ▶▶ (one full episode), Rewind ◀,
   Play/Pause, Reset, and the speed selector — reusing the bandit's playback widgets.
4. **Convergence chart:** RMS error `‖V_est − V_true‖` vs. episode, reusing/generalizing
   the bandit's `RewardChart` (multi-run overlay, metric selector). The analytical `V` is
   the reference.
5. **Trackers panel:** current `V(s)` per reachable state and the current max/RMS error.
6. **Event-log panel:** per-step lines (move, hazard outcome, the update target applied),
   toggleable — reuse `EventLog`.
7. **Settings panel:** behind a gear button; edit `x1`, `x2`, `r1…r4`, `α`, `γ`, `n`, and
   the "Show policy" toggle.

### Reset behavior

- **Auto-reset** when: switching method tab, editing the policy, or changing any
  hyperparameter / hazard prob / reward.
- **Manual reset** via the Reset button (rerolls the seed, matching the bandit).

## Project Structure & File Plan

New pure RL logic in `src/shared/rl/` (no React / DOM / canvas):

- `gridworld.ts` — world types (cells, actions, policy), environment step
  (`step(state, action, rng) → { nextState, reward, done }`), and the **analytical
  solver** (`solveV(world, policy, γ) → V`).
- `td-estimators.ts` — MC / TD(0) / n-step update logic as pure functions over a
  trajectory (or incremental update helpers), plus `rmsError(Vest, Vtrue)`.

New example folder `src/examples/grid-world/`:

- `world.ts` — default world layout + default policy + constants.
- `simulation.ts` — trajectory state machine (step / episode / rewind / derive),
  **start here** for sim logic.
- `scene.ts` — canvas layout math (`computeLayout`, cell↔pixel, hit-testing) +
  `drawScene` (grid, heatmap, character, policy arrows).
- `GridWorldExample.tsx` — page composition + `requestAnimationFrame` loop.

**Routing & landing:** add a `/grid-world` route in `src/main.tsx` and a card in
`EXAMPLES` in `src/pages/Landing.tsx`.

**Shared UI reuse / light generalization:** `PolicyTabs` (method tabs), `SettingsPanel`,
`PlaybackControls`, `SpeedSelector`, `EventLog`, `TrackerPanel`, and `RewardChart`
(generalized so its metric/series model can carry "RMS error vs. episode"). Prefer reuse;
generalize names only where the bandit-specific naming would be misleading.

## Tests

Co-located `__tests__/` next to the code, matching the bandit:

- **Environment:** transitions (movement, wall/edge = stay), hazard sampling
  distributions (with a seeded RNG), terminal handling.
- **Analytical solver:** verified against a small hand-computed MDP and against a
  Monte-Carlo estimate converging to it.
- **Estimators:** MC return computation, TD(0) target, n-step target (including the
  `n=1 ≡ TD(0)` and large-`n ≈ MC` limits, and near-terminal degradation).
- **Delayed-update + rewind correctness:** MC and n-step values derived from a trajectory
  prefix match expected values after rewind/replay.
- **Scene math:** `computeLayout`, cell↔pixel mapping, and click hit-testing.

## Documentation Deliverables

- **`README.md`** — add a short "Grid World — Policy Evaluation" section (scenario + the
  three methods in a sentence each) alongside the bandit section.
- **`AGENTS.md`** — add the `src/examples/grid-world/` layout and the new
  `src/shared/rl/{gridworld,td-estimators}.ts` to "Where to look," and note the
  policy-as-editable-data design and analytical-solver ground truth in the simulation
  model section.

## Out of Scope (YAGNI)

- **No control / policy improvement in v1** — this demo *evaluates* a fixed (but
  editable) policy. Policy iteration is the explicit future extension the design enables,
  but it gets its own spec → plan → implementation cycle.
- **No side-by-side multi-method grids** — methods are compared via tabs (and the
  multi-run convergence chart), not simultaneous grids.
- **No first-visit MC, no TD(λ)/eligibility traces in v1** — every-visit MC and n-step
  TD only. Candidates for later refinement.
- No backend, persistence, or accounts — fully client-side.

## Success Criteria

- Presenter can select each method, **Step** through env steps and **Episode** through
  full walks, auto-run at a chosen speed, rewind, and reset — reliably, live.
- The `V(s)` heatmap visibly converges toward the analytical ground truth, and the
  convergence chart shows error decreasing over episodes.
- The MC-vs-TD contrast is visible: TD(0) propagates value one cell per visit; MC updates
  all visited cells at episode end; sweeping `n` moves n-step between the two behaviors.
- "Show policy" reveals action arrows; clicking a cell changes its action and the value
  estimates re-evaluate for the new policy.
- Editing hazard probabilities / rewards visibly changes the analytical `V` and the
  estimates converge to the new values.
- `pnpm dev` runs locally; `pnpm build` produces a static deployable bundle; `pnpm test`
  passes.
