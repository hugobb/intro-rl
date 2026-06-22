# Grid World Demo — v2 Enhancements

**Date:** 2026-06-21
**Status:** Approved design, pending implementation plan
**Builds on:** `2026-06-21-grid-world-policy-evaluation-design.md` (v1, implemented on `feat/grid-world`)

## Purpose

Enrich the grid-world policy-evaluation demo with: recognizable cell sprites, hazard
and reward animations, an episode "return" score tracker, a state-action value `Q(s,a)`
view, a stochastic ε-soft policy option, selectable RMS-error chart metrics, and a manual
arrow-key drive mode. Everything is **additive**: with the ε-soft noise at `0`, the
Auto control mode, and the V view selected, the demo behaves exactly as v1.

## 1. ε-soft policy

**Config additions** (`SimConfig`): `policyType: "deterministic" | "epsilon"` and
`epsilon: number`. The clickable grid arrows still edit the **base** greedy action
`π(s)`; ε layers noise on top.

**Simulation stepping:** when generating a step at the trajectory tip, choose the action:
with probability `1 − ε` take `π(cell)`; with probability `ε` take a uniformly random
action (RNG-driven, via the seeded RNG). Replay-behind-tip is unchanged (the outcome is
already recorded in the transition). The V/Q estimators are **unaffected** — they consume
`(state, reward, nextState, done)` regardless of how the action was chosen; under ε-soft
they estimate `V^π` for the stochastic policy.

**Analytical ground truth:** generalize `solveV` to
`solveV(world, policy, gamma, epsilon = 0)`. The Bellman backup becomes
`V(s) = Σ_a π(a|s)·[expectedReward(s,a) + γ·(isTerminal(s') ? 0 : V(s'))]`,
where `π(a|s) = (1 − ε)·[a == π(s)] + ε/4`. `epsilon = 0` reduces exactly to the v1
deterministic backup, so all existing tests and behavior are preserved.

**UI:** a `PolicyTypeTabs` selector `[ Deterministic | ε-soft ]`; an ε slider shown only
when ε-soft is active (range 0–1, like the bandit's ε control). Switching policy type or ε
changes `config` and therefore auto-resets the run and recomputes `V_true`.

## 2. Chart RMS metric selector

The convergence chart gains a metric selector (mirroring the bandit `RewardChart` menu)
with three RMS variants, each measured against the ε-aware `V_true`:

- **RMS (path)** — over the greedy-path states (`reachableStates` of the base policy).
- **RMS (visited)** — over the set of states the run actually visited (union of `state`
  values in the applied trajectory). Grows as the ε-soft agent wanders.
- **RMS (all)** — over all non-wall, non-terminal cells (`allStates`). Starts high (unvisited
  cells sit at estimate 0 vs. nonzero true values) and falls as exploration fills the grid.

**Data model:** a saved run stores all three precomputed series
(`{ label, color, rmsPath: number[], rmsVisited: number[], rmsAll: number[] }`); the
selector picks which to plot, so switching metric re-renders instantly. The live run
computes all three each render. `errorSeries(state, vTrue, stateSet)` is the shared
per-state-set series builder. `visited` for a run is the unique `state` values across its
applied trajectory (frozen per saved run); `all` is `allStates(world)`; `path` is the
greedy-chain `reachableStates`. The `StateValueTable` stays focused on the path states.

## 3. Value view: V(s) vs Q(s,a)

**Toggle:** a segmented button `[ V(s) | Q(s,a) ]` (`ValueViewTabs`, same style as method
tabs). It changes only how the **grid** renders; the table and chart stay V-based.

**Q values (model-derived, all four actions):**
`Q(s,a) = expectedReward(s,a) + γ·(isTerminal(s') ? 0 : V_est(s'))`, using the current
estimated `V`. The true-Q reference (when "Show true value" is on) uses `V_true`. This is
a pure function of the already-derived `V` plus the world model — no new estimator and no
change to the trajectory/replay machinery. By construction `Q(s, π(s)) ≈ V(s)`; the other
three actions show "what if I'd gone this way." Under ε-soft, `V_est` is `V^π` for the
ε-soft policy, so the derived `Q` are action values under that policy — consistent.

A pure `computeQ(world, vEst, gamma) → number[][]` (indexed `[cell][actionIndex]`, action
order = `ACTIONS`) is added to `gridworld.ts` and unit-tested.

**Rendering — triangular quadrants:** in Q view each non-terminal, non-wall cell is split
into 4 triangles (up/down/left/right meeting at the center). Each triangle is filled with
the heatmap color of its `Q(s,a)` and shows the value (small text). Walls stay solid; the
terminal still shows the restaurant. The policy-arrow overlay (when "Show policy" is on)
draws on top. Heatmap `maxAbs` in Q view is `max(1, max|Q_true|)`; in V view it stays
`max(1, max|V_true|)`. A pure `cellQuadrant(layout, cell, action) → trianglePoints` helper
(in `scene.ts`) is unit-tested; the quadrant fill/text is part of the untested `drawScene`.

## 4. Cell sprites

Replace the v1 glyph labels with recognizable pixel-art drawn on the canvas (using the
existing palette), each as a `drawX(ctx, rect)` helper in `scene.ts` (renderer, not
unit-tested), drawn *under* the heatmap tint and value text so the cell still reads its
color:

- **Restaurant** — a storefront with a sign (reuse the bandit storefront vocabulary).
- **Road** — grey asphalt with a dashed center lane line.
- **Crosswalk** — road plus white zebra stripes.
- **Manhole** — a dark circle with rim detail.
- **Poutine** — a small bowl/box shape.

## 5. Animations (one-shot, retro)

A small effect model on `SceneState`, advanced by the existing rAF loop; effects fire only
on **live forward steps** (not on rewind/replay scrub):

- **Reward pop** — every step with a nonzero reward spawns a floating number at the
  character's cell (`+4` poutine green, `−10` crash red, `+10` restaurant), rising and
  fading over ~600 ms.
- **Car crash** — when a generated/chosen step enters a road (off-crosswalk) cell *and*
  the accident fired (reward shows the `−r1` penalty): a car sprite slides across the row
  and a burst flashes on the character (~500 ms). Plays together with the `−r1` reward pop.
- **Manhole fall** — when a step enters a manhole and the fall fired (`−r2`): the character
  sinks/shrinks into the hole (~500 ms), with the `−r2` reward pop.

**Mechanism:** `commitStep` (and `chooseAction` handling) detects the hazard from the
record (entered cell type + reward more negative than `−stepCost`) and sets
`effect = { kind: "crash" | "fall", cell, progress: 0 }` and/or a `rewardPop =
{ value, cell, progress: 0 }` on a page ref; the rAF loop advances `progress` to 1 and
clears; `drawScene` renders from `effect`/`rewardPop` fields on `SceneState`.

## 6. Episode return tracker (8-bit score)

A retro score readout (`ReturnTracker` component, pixel font) showing the **current
episode's running return** (cumulative undiscounted reward since the episode started) plus
the **last completed episode's return**, e.g. `RETURN 6   LAST 2`. Resets when a new
episode begins. A pure, unit-tested helper `episodeReturn(state) → { current: number;
last: number | null }` in `simulation.ts` computes both from the trajectory prefix
(`current` = sum of rewards since the last `done`; `last` = sum over the previous completed
episode). This is the undiscounted "score"; the discounted return `G` still drives MC and
the chart.

## 7. Manual mode (arrow-key drive)

**Control-mode selector:** `ControlModeTabs` `[ Auto (policy) | Manual (arrow keys) ]`,
backed by `controlMode: "policy" | "manual"` in `SimConfig`. In **Auto** mode everything
works as in Sections 1–6 (policy/ε-soft generate steps via Step/Episode/Play). In
**Manual** mode the user drives one step per arrow-key press.

**Mechanism:** a pure `chooseAction(state, action) → { state, record }` in `simulation.ts`
(mirroring the bandit `chooseArm`): samples the reward for taking `action` at the current
cell, truncates any rewound future (slice to pointer), appends the transition (with the
loop-guard truncation rule applied as in `stepForward`). A page-level `keydown` listener,
active only in Manual mode, maps `ArrowUp/Down/Left/Right → chooseAction` and calls
`preventDefault` so the page doesn't scroll. Each press is a live forward step, so reward
pops, crash/fall animations, and the return tracker all fire; episodes end at the
restaurant and reset to start.

**UI in Manual mode:** reuse `PlaybackControls`' existing `manual` prop to hide Play/Step;
also hide the Episode button and the policy-type/ε controls (they don't apply when the user
drives); keep Back and Reset. Show a hint: "Use arrow keys to move." The estimators still
learn `V`/`Q` from the manually-collected trajectory.

**Ground truth in Manual mode:** `V_true` (and derived `Q_true`) keep reflecting the
displayed base policy (+ current policy-type/ε) as the target the policy would achieve.
Manual driving collects potentially off-policy experience against that reference, so the
estimates may not converge to the true line — an honest illustration of off-policy
sampling. The three RMS metrics still compute (visited is most meaningful here).

## File / Test Plan

**Pure logic — `src/shared/rl/gridworld.ts`** (new unit tests):
- `solveV(world, policy, gamma, epsilon = 0)` — ε-soft expected backup; tests for an
  ε-soft solve on a small MDP and that `epsilon = 0` is unchanged.
- `computeQ(world, vEst, gamma) → number[][]` — model-derived Q; tested incl. `Q(s,π(s))`
  matching the V-backup.
- `allStates(world) → number[]` — non-wall, non-terminal cells; tested.

**`src/examples/grid-world/`:**
- `world.ts` — add `DEFAULT_EPSILON`, `DEFAULT_POLICY_TYPE`, `DEFAULT_CONTROL_MODE`.
- `simulation.ts` — `SimConfig` gains `policyType`, `epsilon`, `controlMode`; ε-soft action
  choice in the generate branch; `chooseAction`; pure helpers `visitedStates(state)` and
  `episodeReturn(state)`. Tests: ε-soft action determinism (seeded), `chooseAction`
  truncate+append, `visitedStates`, `episodeReturn`.
- `scene.ts` — pure `cellQuadrant(layout, cell, action)` (tested); `drawScene` extended
  with per-type sprites, Q-quadrant rendering, and effect/reward-pop rendering (untested).
  `SceneState` gains `valueView`, `q`, `qMaxAbs`, `effect`, `rewardPop`.
- New components (each with a render/onChange test): `ValueViewTabs`, `PolicyTypeTabs`,
  `ControlModeTabs`, `ReturnTracker`.
- `ConvergenceChart.tsx` — add `RmsMetric` (`"path" | "visited" | "all"`) selector with
  `metric` / `onMetricChange` props; test the selector renders three options and fires
  `onMetricChange`.
- `GridWorldExample.tsx` — wire policy-type tabs + ε slider, value-view tabs, control-mode
  tabs + keydown effect, chart-metric state + three RMS series per run, `computeQ` for the
  scene, ε-aware `solveV`, effect/reward-pop state + hazard detection in
  `commitStep`/`chooseAction`, `ReturnTracker`. Existing mount test stays; add an assertion
  that toggling to Q view renders, and that an arrow key in Manual mode advances a step.

**Docs:** update `README.md` and `AGENTS.md` with the ε-soft policy, V/Q toggle, chart
metrics, manual mode, and the new sprites/animations.

## Out of Scope (YAGNI)

- No model-free Q-table estimator (Sarsa) — Q is model-derived from the V estimate, which
  is exactly `V^π` for the policy; a separate Q track would be redundant for this demo.
- No policy improvement / control — still policy *evaluation*. (Future work, per v1 spec.)
- No first-visit MC, no TD(λ) — unchanged from v1.
- Manual mode does not redefine the ground truth as the user's behavior policy; `V_true`
  stays the displayed policy's value (off-policy collection is the intended lesson).

## Success Criteria

- ε-soft: with ε > 0 the agent visibly wanders off the greedy path; `V_true` and the
  estimates still agree on the path as it converges; ε = 0 is identical to v1.
- Chart: switching RMS metric (path / visited / all) re-plots instantly; "all" starts high
  and falls as exploration spreads under ε-soft.
- Q view: toggling `[ V(s) | Q(s,a) ]` shows four-quadrant action values; `Q(s,π(s))`
  tracks `V(s)`.
- Sprites: restaurant, road, crosswalk, manhole, and poutine are visually distinguishable.
- Animations: crossing the road off-crosswalk and hitting the manhole show the crash/fall
  effects; every reward shows a floating number; the return tracker counts the episode
  score and resets each episode.
- Manual mode: arrow keys move the character one step each; reward/animation/return all
  fire; Play/Step/Episode are hidden; Back/Reset work.
- `pnpm typecheck`, `pnpm exec vitest run`, and `pnpm build` all pass.
