# Multi-Armed Bandit RL Demo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a zero-friction, extensible interactive web app whose first example teaches the multi-armed bandit problem via a poutine-restaurant scenario, with four selectable policies, step/rewind/play controls, live value trackers, and an 8-bit canvas animation.

**Architecture:** pnpm + Vite + React + TypeScript single-page app with React Router (landing page + one route per example). Pure RL logic lives in `src/shared/rl/` (no React, no DOM). The bandit simulation is a trajectory-based state machine with a seeded RNG, enabling deterministic step-forward, step-back/rewind, and replay. React renders the reactive UI (tabs, trackers, controls); a plain `<canvas>` renders the hand-rolled pixel-art animation driven by `requestAnimationFrame`.

**Tech Stack:** pnpm, Vite, React 19, TypeScript (strict), React Router, Vitest + jsdom + @testing-library/react, @fontsource/press-start-2p. No game engine.

## Global Constraints

- Package manager is **pnpm** (never npm/yarn in commands).
- TypeScript **strict** mode; no `any`; explicit types on exported functions.
- `src/shared/rl/` is **pure**: no React, no DOM, no canvas, no Vite/Next imports. Type-only imports between rl modules are fine.
- Canvas/pixel rendering is isolated in `src/shared/pixel/` and `src/examples/*/scene.ts`. Rendering functions are not unit-tested; their **pure math helpers are**.
- Restaurants, in true order: **Chez Claudette (2.5) > La Banquise (2.2) > Poutineville (1.7)**. Default categorical distributions [P(1★),P(2★),P(3★)]: Chez Claudette `[0.1,0.3,0.6]`, La Banquise `[0.2,0.4,0.4]`, Poutineville `[0.5,0.3,0.2]`.
- Ratings are integers in **{1,2,3}**.
- Estimates use the incremental sample-average update `Q ← Q + (1/n)(R − Q)`. Optimistic init only changes the **initial** Q value (default init `4`).
- Speed options are exactly: **0.5×, 1×, 2×, 5×, 10×, 25×, 50×**. Walk animation always plays (just faster) — no snapping/teleporting.
- Policy tabs: Random, Greedy, Optimistic Init, ε-Greedy. Switching policy or changing ε / init value / distributions **auto-resets**; Reset button is the only other reset.
- Default ε = `0.1`. Default seed = `12345`.

---

## File Structure

**Create:**
- `package.json`, `pnpm-workspace.yaml` (optional, omit), `vite.config.ts`, `tsconfig.json`, `tsconfig.node.json`, `index.html`, `.gitignore` (exists)
- `src/main.tsx` — React Router setup
- `src/vite-env.d.ts`
- `src/test/setup.ts` — testing-library/jest-dom setup
- `src/pages/Landing.tsx` — example grid
- `src/shared/rl/rng.ts` — seeded RNG (pure)
- `src/shared/rl/estimator.ts` — incremental sample-average estimates (pure)
- `src/shared/rl/reward.ts` — categorical sampling + true mean (pure)
- `src/shared/rl/policies.ts` — action selection (pure)
- `src/shared/pixel/palette.ts` — retro palette + font family constant
- `src/shared/pixel/canvas.ts` — DPR-aware canvas sizing helper (pure-ish math)
- `src/shared/ui/PlaybackControls.tsx`, `SpeedSelector.tsx`, `PolicyTabs.tsx`, `ValueBar.tsx`, `TrackerPanel.tsx`, `SettingsPanel.tsx`, `EventLog.tsx`, `Toggle.tsx`
- `src/examples/multi-armed-bandit/simulation.ts` — trajectory state machine (pure)
- `src/examples/multi-armed-bandit/scene.ts` — layout math (pure) + drawScene (render)
- `src/examples/multi-armed-bandit/BanditExample.tsx` — page composition + animation loop
- `src/examples/multi-armed-bandit/restaurants.ts` — default restaurant data
- `src/styles.css` — global retro styling
- Tests co-located under `src/**/__tests__/*.test.ts(x)`
- `README.md`, `AGENTS.md`, `CLAUDE.md`

---

## Task 1: Project scaffold + tooling

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `tsconfig.node.json`, `index.html`, `src/main.tsx`, `src/vite-env.d.ts`, `src/test/setup.ts`, `src/pages/Landing.tsx`, `src/styles.css`
- Test: `src/shared/__tests__/smoke.test.ts`

**Interfaces:**
- Produces: a runnable Vite+React+TS app at route `/` (Landing) and `pnpm test` running Vitest.

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "intro-rl",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc -b --noEmit"
  },
  "dependencies": {
    "@fontsource/press-start-2p": "^5.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "react-router-dom": "^7.0.0"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.4.0",
    "@testing-library/react": "^16.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^4.3.0",
    "jsdom": "^25.0.0",
    "typescript": "^5.6.0",
    "vite": "^6.0.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json` and `tsconfig.node.json`**

`tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "baseUrl": ".",
    "paths": { "@/*": ["src/*"] },
    "types": ["vitest/globals", "@testing-library/jest-dom"]
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

`tsconfig.node.json`:

```json
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "noEmit": true
  },
  "include": ["vite.config.ts"]
}
```

- [ ] **Step 3: Create `vite.config.ts`**

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
  },
});
```

- [ ] **Step 4: Create `index.html`, `src/test/setup.ts`, `src/vite-env.d.ts`, `src/styles.css`**

`index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Intro to RL — Interactive Demos</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`src/test/setup.ts`:

```ts
import "@testing-library/jest-dom/vitest";
```

`src/vite-env.d.ts`:

```ts
/// <reference types="vite/client" />
```

`src/styles.css`:

```css
@import "@fontsource/press-start-2p/index.css";

:root {
  --bg: #1a1c2c;
  --panel: #29366f;
  --ink: #f4f4f4;
  --accent: #ffcd75;
  --good: #38b764;
  --mid: #41a6f6;
  --bad: #ef7d57;
  font-family: "Press Start 2P", system-ui, sans-serif;
}

* { box-sizing: border-box; }

body {
  margin: 0;
  background: var(--bg);
  color: var(--ink);
  font-size: 12px;
  line-height: 1.6;
}

a { color: var(--accent); }

.app { max-width: 1000px; margin: 0 auto; padding: 24px; }

button {
  font-family: inherit;
  background: var(--panel);
  color: var(--ink);
  border: 2px solid var(--ink);
  padding: 8px 10px;
  cursor: pointer;
}
button:hover { background: var(--accent); color: var(--bg); }
button[aria-pressed="true"], button.active { background: var(--accent); color: var(--bg); }

canvas { image-rendering: pixelated; width: 100%; height: auto; background: #0f1020; }
```

- [ ] **Step 5: Create `src/pages/Landing.tsx` and `src/main.tsx`**

`src/pages/Landing.tsx`:

```tsx
import { Link } from "react-router-dom";

const EXAMPLES = [
  {
    path: "/multi-armed-bandit",
    title: "Multi-Armed Bandit",
    blurb: "Find the best poutine in Montréal. Random, greedy, optimistic init, and ε-greedy policies.",
  },
];

export function Landing() {
  return (
    <div className="app">
      <h1>Intro to Reinforcement Learning</h1>
      <p>Interactive demos for the lecture.</p>
      <ul>
        {EXAMPLES.map((e) => (
          <li key={e.path}>
            <Link to={e.path}>{e.title}</Link> — {e.blurb}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

`src/main.tsx`:

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { Landing } from "./pages/Landing";
import { BanditExample } from "./examples/multi-armed-bandit/BanditExample";
import "./styles.css";

const router = createBrowserRouter([
  { path: "/", element: <Landing /> },
  { path: "/multi-armed-bandit", element: <BanditExample /> },
]);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
```

> Note: `BanditExample` is created in Task 10. Until then, temporarily stub it to unblock dev/build: create `src/examples/multi-armed-bandit/BanditExample.tsx` with `export function BanditExample() { return <div className="app">Coming soon</div>; }` and replace it fully in Task 10.

- [ ] **Step 6: Write the smoke test** — `src/shared/__tests__/smoke.test.ts`

```ts
import { describe, it, expect } from "vitest";

describe("tooling", () => {
  it("runs vitest", () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 7: Install and verify**

Run: `pnpm install`
Run: `pnpm test`
Expected: 1 passing test.
Run: `pnpm dev` then open `http://localhost:5173` — Landing page shows the example link. Stop the server.
Run: `pnpm build`
Expected: build completes, `dist/` produced.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "chore: scaffold vite+react+ts app with vitest and routing"
```

---

## Task 2: Seeded RNG

**Files:**
- Create: `src/shared/rl/rng.ts`
- Test: `src/shared/rl/__tests__/rng.test.ts`

**Interfaces:**
- Produces:
  - `interface RNG { next(): number; int(maxExclusive: number): number; }`
  - `function createRng(seed: number): RNG` — `next()` returns float in [0,1); `int(m)` returns integer in [0,m).

- [ ] **Step 1: Write the failing test** — `src/shared/rl/__tests__/rng.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { createRng } from "../rng";

describe("createRng", () => {
  it("is deterministic for the same seed", () => {
    const a = createRng(42);
    const b = createRng(42);
    const seqA = [a.next(), a.next(), a.next()];
    const seqB = [b.next(), b.next(), b.next()];
    expect(seqA).toEqual(seqB);
  });

  it("returns floats in [0,1)", () => {
    const r = createRng(1);
    for (let i = 0; i < 1000; i++) {
      const v = r.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("int(m) returns integers in [0,m)", () => {
    const r = createRng(7);
    for (let i = 0; i < 1000; i++) {
      const v = r.int(3);
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(3);
    }
  });

  it("different seeds produce different sequences", () => {
    expect(createRng(1).next()).not.toBe(createRng(2).next());
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/shared/rl/__tests__/rng.test.ts`
Expected: FAIL — cannot find module `../rng`.

- [ ] **Step 3: Write minimal implementation** — `src/shared/rl/rng.ts`

```ts
export interface RNG {
  /** Float in [0, 1). */
  next(): number;
  /** Integer in [0, maxExclusive). */
  int(maxExclusive: number): number;
}

/** Deterministic mulberry32 PRNG. */
export function createRng(seed: number): RNG {
  let a = seed >>> 0;
  const next = (): number => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (maxExclusive: number): number => Math.floor(next() * maxExclusive),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/shared/rl/__tests__/rng.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/shared/rl/rng.ts src/shared/rl/__tests__/rng.test.ts
git commit -m "feat: seeded mulberry32 RNG"
```

---

## Task 3: Estimator (incremental sample-average)

**Files:**
- Create: `src/shared/rl/estimator.ts`
- Test: `src/shared/rl/__tests__/estimator.test.ts`

**Interfaces:**
- Produces:
  - `interface Estimates { q: number[]; counts: number[]; }`
  - `function createEstimates(numArms: number, initValue: number): Estimates`
  - `function updateEstimate(est: Estimates, arm: number, reward: number): Estimates` — returns a NEW object (immutable), applies `Q ← Q + (1/n)(R − Q)` with `n` = post-increment count.

- [ ] **Step 1: Write the failing test** — `src/shared/rl/__tests__/estimator.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { createEstimates, updateEstimate } from "../estimator";

describe("estimator", () => {
  it("initializes q to initValue and counts to 0", () => {
    const est = createEstimates(3, 4);
    expect(est.q).toEqual([4, 4, 4]);
    expect(est.counts).toEqual([0, 0, 0]);
  });

  it("first update sets q to the reward (sample average)", () => {
    let est = createEstimates(3, 0);
    est = updateEstimate(est, 1, 3);
    expect(est.q[1]).toBe(3);
    expect(est.counts[1]).toBe(1);
  });

  it("converges to the running mean", () => {
    let est = createEstimates(1, 0);
    for (const r of [1, 2, 3]) est = updateEstimate(est, 0, r);
    expect(est.q[0]).toBeCloseTo(2, 10);
    expect(est.counts[0]).toBe(3);
  });

  it("does not mutate the input", () => {
    const est = createEstimates(2, 0);
    const next = updateEstimate(est, 0, 3);
    expect(est.q[0]).toBe(0);
    expect(est.counts[0]).toBe(0);
    expect(next).not.toBe(est);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/shared/rl/__tests__/estimator.test.ts`
Expected: FAIL — cannot find module `../estimator`.

- [ ] **Step 3: Write minimal implementation** — `src/shared/rl/estimator.ts`

```ts
export interface Estimates {
  q: number[];
  counts: number[];
}

export function createEstimates(numArms: number, initValue: number): Estimates {
  return {
    q: Array<number>(numArms).fill(initValue),
    counts: Array<number>(numArms).fill(0),
  };
}

/** Immutable incremental sample-average update: Q ← Q + (1/n)(R − Q). */
export function updateEstimate(est: Estimates, arm: number, reward: number): Estimates {
  const q = est.q.slice();
  const counts = est.counts.slice();
  counts[arm] += 1;
  q[arm] = q[arm] + (1 / counts[arm]) * (reward - q[arm]);
  return { q, counts };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/shared/rl/__tests__/estimator.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/shared/rl/estimator.ts src/shared/rl/__tests__/estimator.test.ts
git commit -m "feat: incremental sample-average estimator"
```

---

## Task 4: Reward model (categorical sampling + true mean)

**Files:**
- Create: `src/shared/rl/reward.ts`
- Test: `src/shared/rl/__tests__/reward.test.ts`

**Interfaces:**
- Consumes: `RNG` from `./rng`.
- Produces:
  - `type Categorical = [number, number, number]` — probabilities of [1★, 2★, 3★].
  - `function sampleRating(dist: Categorical, rng: RNG): 1 | 2 | 3`
  - `function trueMean(dist: Categorical): number`

- [ ] **Step 1: Write the failing test** — `src/shared/rl/__tests__/reward.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { sampleRating, trueMean, type Categorical } from "../reward";
import { createRng } from "../rng";

describe("reward model", () => {
  it("computes the true mean", () => {
    expect(trueMean([0.1, 0.3, 0.6])).toBeCloseTo(2.5, 10);
    expect(trueMean([0.5, 0.3, 0.2])).toBeCloseTo(1.7, 10);
  });

  it("only returns 1, 2, or 3", () => {
    const rng = createRng(3);
    const dist: Categorical = [0.2, 0.4, 0.4];
    for (let i = 0; i < 500; i++) {
      expect([1, 2, 3]).toContain(sampleRating(dist, rng));
    }
  });

  it("empirical mean approaches the true mean", () => {
    const rng = createRng(99);
    const dist: Categorical = [0.1, 0.3, 0.6];
    let sum = 0;
    const n = 20000;
    for (let i = 0; i < n; i++) sum += sampleRating(dist, rng);
    expect(sum / n).toBeCloseTo(trueMean(dist), 1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/shared/rl/__tests__/reward.test.ts`
Expected: FAIL — cannot find module `../reward`.

- [ ] **Step 3: Write minimal implementation** — `src/shared/rl/reward.ts`

```ts
import type { RNG } from "./rng";

/** Probabilities of [1★, 2★, 3★]; should sum to 1. */
export type Categorical = [number, number, number];

export function sampleRating(dist: Categorical, rng: RNG): 1 | 2 | 3 {
  const r = rng.next();
  if (r < dist[0]) return 1;
  if (r < dist[0] + dist[1]) return 2;
  return 3;
}

export function trueMean(dist: Categorical): number {
  return 1 * dist[0] + 2 * dist[1] + 3 * dist[2];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/shared/rl/__tests__/reward.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/shared/rl/reward.ts src/shared/rl/__tests__/reward.test.ts
git commit -m "feat: categorical reward model"
```

---

## Task 5: Policies (action selection)

**Files:**
- Create: `src/shared/rl/policies.ts`
- Test: `src/shared/rl/__tests__/policies.test.ts`

**Interfaces:**
- Consumes: `RNG` from `./rng`, `Estimates` from `./estimator`.
- Produces:
  - `type PolicyKind = "random" | "greedy" | "optimistic" | "epsilon-greedy"`
  - `function argmaxRandomTie(values: number[], rng: RNG): number`
  - `function selectArm(kind: PolicyKind, est: Estimates, epsilon: number, rng: RNG): number`
- Notes: "optimistic" selection is identical to "greedy" (optimism lives in the estimator's init value). For `epsilon-greedy`, the policy always draws ONE `rng.next()` for the explore check, then `rng.int(n)` if exploring or `argmaxRandomTie` otherwise.

- [ ] **Step 1: Write the failing test** — `src/shared/rl/__tests__/policies.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { selectArm, argmaxRandomTie } from "../policies";
import { createRng } from "../rng";
import type { Estimates } from "../estimator";

const est = (q: number[]): Estimates => ({ q, counts: q.map(() => 0) });

describe("argmaxRandomTie", () => {
  it("returns the unique max index", () => {
    expect(argmaxRandomTie([1, 5, 2], createRng(1))).toBe(1);
  });

  it("breaks ties within the tied set", () => {
    const rng = createRng(1);
    const seen = new Set<number>();
    for (let i = 0; i < 200; i++) seen.add(argmaxRandomTie([3, 3, 1], rng));
    expect([...seen].sort()).toEqual([0, 1]);
  });
});

describe("selectArm", () => {
  it("greedy always picks the max", () => {
    const rng = createRng(1);
    for (let i = 0; i < 50; i++) {
      expect(selectArm("greedy", est([1, 9, 2]), 0, rng)).toBe(1);
    }
  });

  it("optimistic selects like greedy", () => {
    const rng = createRng(1);
    expect(selectArm("optimistic", est([1, 9, 2]), 0, rng)).toBe(1);
  });

  it("random spreads across all arms", () => {
    const rng = createRng(2);
    const seen = new Set<number>();
    for (let i = 0; i < 200; i++) seen.add(selectArm("random", est([1, 9, 2]), 0, rng));
    expect([...seen].sort()).toEqual([0, 1, 2]);
  });

  it("epsilon-greedy with epsilon=0 is greedy", () => {
    const rng = createRng(5);
    for (let i = 0; i < 50; i++) {
      expect(selectArm("epsilon-greedy", est([1, 9, 2]), 0, rng)).toBe(1);
    }
  });

  it("epsilon-greedy with epsilon=1 explores all arms", () => {
    const rng = createRng(5);
    const seen = new Set<number>();
    for (let i = 0; i < 300; i++) seen.add(selectArm("epsilon-greedy", est([1, 9, 2]), 1, rng));
    expect([...seen].sort()).toEqual([0, 1, 2]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/shared/rl/__tests__/policies.test.ts`
Expected: FAIL — cannot find module `../policies`.

- [ ] **Step 3: Write minimal implementation** — `src/shared/rl/policies.ts`

```ts
import type { RNG } from "./rng";
import type { Estimates } from "./estimator";

export type PolicyKind = "random" | "greedy" | "optimistic" | "epsilon-greedy";

/** Argmax with uniform random tie-breaking among the maxima. */
export function argmaxRandomTie(values: number[], rng: RNG): number {
  let best = -Infinity;
  let ties: number[] = [];
  for (let i = 0; i < values.length; i++) {
    if (values[i] > best) {
      best = values[i];
      ties = [i];
    } else if (values[i] === best) {
      ties.push(i);
    }
  }
  return ties[rng.int(ties.length)];
}

export function selectArm(
  kind: PolicyKind,
  est: Estimates,
  epsilon: number,
  rng: RNG,
): number {
  const n = est.q.length;
  if (kind === "random") return rng.int(n);
  if (kind === "epsilon-greedy") {
    if (rng.next() < epsilon) return rng.int(n);
    return argmaxRandomTie(est.q, rng);
  }
  // greedy and optimistic share selection logic
  return argmaxRandomTie(est.q, rng);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/shared/rl/__tests__/policies.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/shared/rl/policies.ts src/shared/rl/__tests__/policies.test.ts
git commit -m "feat: action-selection policies"
```

---

## Task 6: Bandit simulation state machine

**Files:**
- Create: `src/examples/multi-armed-bandit/simulation.ts`
- Test: `src/examples/multi-armed-bandit/__tests__/simulation.test.ts`

**Interfaces:**
- Consumes: `createRng`/`RNG`, `Categorical`/`sampleRating`, `createEstimates`/`updateEstimate`/`Estimates`, `PolicyKind`/`selectArm`.
- Produces:
  - `interface Restaurant { name: string; dist: Categorical; }`
  - `interface SimConfig { restaurants: Restaurant[]; policy: PolicyKind; epsilon: number; optimisticInit: number; seed: number; }`
  - `interface StepRecord { arm: number; reward: number; }`
  - `interface SimState { config: SimConfig; trajectory: StepRecord[]; pointer: number; rng: RNG; }`
  - `interface DerivedState { q: number[]; counts: number[]; step: number; }`
  - `function createSim(config: SimConfig): SimState`
  - `function derive(state: SimState): DerivedState`
  - `function stepForward(state: SimState): { state: SimState; record: StepRecord }`
  - `function stepBack(state: SimState): SimState`
  - `function reset(state: SimState, seed?: number): SimState`
- Semantics: `pointer` = number of applied steps (0..trajectory.length). Forward at the tip generates a new record using the live `rng` and policy; forward when `pointer < trajectory.length` REPLAYS the stored record without touching the rng. Optimistic init value applies only when `policy === "optimistic"`.

- [ ] **Step 1: Write the failing test** — `src/examples/multi-armed-bandit/__tests__/simulation.test.ts`

```ts
import { describe, it, expect } from "vitest";
import {
  createSim,
  derive,
  stepForward,
  stepBack,
  reset,
  type SimConfig,
  type Restaurant,
} from "../simulation";

const restaurants: Restaurant[] = [
  { name: "A", dist: [0.1, 0.3, 0.6] },
  { name: "B", dist: [0.2, 0.4, 0.4] },
  { name: "C", dist: [0.5, 0.3, 0.2] },
];

const cfg = (over: Partial<SimConfig> = {}): SimConfig => ({
  restaurants,
  policy: "random",
  epsilon: 0.1,
  optimisticInit: 4,
  seed: 12345,
  ...over,
});

describe("simulation", () => {
  it("starts empty", () => {
    const d = derive(createSim(cfg()));
    expect(d.step).toBe(0);
    expect(d.counts).toEqual([0, 0, 0]);
    expect(d.q).toEqual([0, 0, 0]);
  });

  it("optimistic init sets starting q to the init value", () => {
    const d = derive(createSim(cfg({ policy: "optimistic" })));
    expect(d.q).toEqual([4, 4, 4]);
  });

  it("stepForward advances the pointer and records a step", () => {
    const { state, record } = stepForward(createSim(cfg()));
    expect(derive(state).step).toBe(1);
    expect([0, 1, 2]).toContain(record.arm);
    expect([1, 2, 3]).toContain(record.reward);
    expect(derive(state).counts[record.arm]).toBe(1);
  });

  it("is deterministic for the same seed", () => {
    let a = createSim(cfg());
    let b = createSim(cfg());
    for (let i = 0; i < 20; i++) {
      a = stepForward(a).state;
      b = stepForward(b).state;
    }
    expect(a.trajectory).toEqual(b.trajectory);
  });

  it("stepBack then stepForward replays the same record (no rng change)", () => {
    let s = createSim(cfg());
    for (let i = 0; i < 5; i++) s = stepForward(s).state;
    const before = s.trajectory.slice();
    s = stepBack(s);
    expect(derive(s).step).toBe(4);
    const { state, record } = stepForward(s);
    expect(record).toEqual(before[4]);
    expect(state.trajectory).toEqual(before);
  });

  it("continues generating new records after rewinding to the tip", () => {
    let s = createSim(cfg());
    for (let i = 0; i < 3; i++) s = stepForward(s).state;
    s = stepBack(s);
    s = stepForward(s).state; // replays index 2
    const { state } = stepForward(s); // genuinely new at tip
    expect(state.trajectory.length).toBe(4);
    expect(derive(state).step).toBe(4);
  });

  it("stepBack at zero is a no-op", () => {
    const s = createSim(cfg());
    expect(stepBack(s)).toBe(s);
  });

  it("reset clears the trajectory and reuses the seed by default", () => {
    let s = createSim(cfg());
    for (let i = 0; i < 5; i++) s = stepForward(s).state;
    const r = reset(s);
    expect(derive(r).step).toBe(0);
    expect(r.trajectory).toEqual([]);
    // same seed → same first step as a fresh sim
    const fresh = stepForward(createSim(cfg())).state;
    expect(stepForward(r).state.trajectory[0]).toEqual(fresh.trajectory[0]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/examples/multi-armed-bandit/__tests__/simulation.test.ts`
Expected: FAIL — cannot find module `../simulation`.

- [ ] **Step 3: Write minimal implementation** — `src/examples/multi-armed-bandit/simulation.ts`

```ts
import { createRng, type RNG } from "@/shared/rl/rng";
import { sampleRating, type Categorical } from "@/shared/rl/reward";
import {
  createEstimates,
  updateEstimate,
  type Estimates,
} from "@/shared/rl/estimator";
import { selectArm, type PolicyKind } from "@/shared/rl/policies";

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

function estimatesAt(state: SimState): Estimates {
  let est = createEstimates(state.config.restaurants.length, initValueFor(state.config));
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
  const arm = selectArm(state.config.policy, est, state.config.epsilon, state.rng);
  const reward = sampleRating(state.config.restaurants[arm].dist, state.rng);
  const record: StepRecord = { arm, reward };
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/examples/multi-armed-bandit/__tests__/simulation.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
git add src/examples/multi-armed-bandit/simulation.ts src/examples/multi-armed-bandit/__tests__/simulation.test.ts
git commit -m "feat: trajectory-based bandit simulation"
```

---

## Task 7: Pixel helpers (palette + canvas sizing)

**Files:**
- Create: `src/shared/pixel/palette.ts`, `src/shared/pixel/canvas.ts`
- Test: `src/shared/pixel/__tests__/canvas.test.ts`

**Interfaces:**
- Produces:
  - `palette.ts`: `const PALETTE` (named retro colors) and `const PIXEL_FONT = '"Press Start 2P", monospace'`, `const STORE_COLORS: string[]`.
  - `canvas.ts`: `function fitCanvas(canvas: HTMLCanvasElement, cssWidth: number, cssHeight: number, dpr: number): { width: number; height: number }` — sets backing store size = css size × dpr, returns the backing pixel dimensions.

- [ ] **Step 1: Write the failing test** — `src/shared/pixel/__tests__/canvas.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { fitCanvas } from "../canvas";

describe("fitCanvas", () => {
  it("scales the backing store by dpr and sets css size", () => {
    const canvas = document.createElement("canvas");
    const dims = fitCanvas(canvas, 320, 180, 2);
    expect(dims).toEqual({ width: 640, height: 360 });
    expect(canvas.width).toBe(640);
    expect(canvas.height).toBe(360);
    expect(canvas.style.width).toBe("320px");
    expect(canvas.style.height).toBe("180px");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/shared/pixel/__tests__/canvas.test.ts`
Expected: FAIL — cannot find module `../canvas`.

- [ ] **Step 3: Write the implementations**

`src/shared/pixel/palette.ts`:

```ts
/** Retro palette (Sweetie-16 inspired). */
export const PALETTE = {
  bg: "#0f1020",
  ground: "#566c86",
  sky: "#1a1c2c",
  ink: "#f4f4f4",
  accent: "#ffcd75",
  good: "#38b764",
  mid: "#41a6f6",
  bad: "#ef7d57",
  skin: "#ffcd75",
  body: "#41a6f6",
  star: "#ffcd75",
} as const;

export const PIXEL_FONT = '"Press Start 2P", monospace';

/** One accent color per restaurant storefront, in order. */
export const STORE_COLORS: string[] = ["#ef7d57", "#38b764", "#41a6f6"];
```

`src/shared/pixel/canvas.ts`:

```ts
export interface CanvasDims {
  width: number;
  height: number;
}

/** Size a canvas for crisp pixel rendering on high-DPR displays. */
export function fitCanvas(
  canvas: HTMLCanvasElement,
  cssWidth: number,
  cssHeight: number,
  dpr: number,
): CanvasDims {
  const width = Math.round(cssWidth * dpr);
  const height = Math.round(cssHeight * dpr);
  canvas.width = width;
  canvas.height = height;
  canvas.style.width = `${cssWidth}px`;
  canvas.style.height = `${cssHeight}px`;
  return { width, height };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/shared/pixel/__tests__/canvas.test.ts`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add src/shared/pixel
git commit -m "feat: pixel palette and canvas sizing helper"
```

---

## Task 8: Scene layout math + renderer

**Files:**
- Create: `src/examples/multi-armed-bandit/scene.ts`
- Test: `src/examples/multi-armed-bandit/__tests__/scene.test.ts`

**Interfaces:**
- Consumes: `PALETTE`, `STORE_COLORS`, `PIXEL_FONT` from `@/shared/pixel/*`.
- Produces:
  - `type WalkPhase = "idle" | "walking-to" | "rating" | "walking-back"`
  - `interface SceneLayout { width: number; height: number; homeX: number; groundY: number; storeXs: number[]; }`
  - `function computeLayout(width: number, height: number, numStores: number): SceneLayout`
  - `function characterX(layout: SceneLayout, phase: WalkPhase, progress: number, targetArm: number): number`
  - `interface SceneState { layout: SceneLayout; names: string[]; counts: number[]; phase: WalkPhase; progress: number; targetArm: number; lastRating: number | null; }`
  - `function drawScene(ctx: CanvasRenderingContext2D, scene: SceneState): void` (render only; not unit-tested)
- Semantics: `characterX` interpolates home→store on `walking-to`, holds at the store on `rating`, store→home on `walking-back`, and returns `homeX` on `idle`. `progress` is clamped to [0,1].

- [ ] **Step 1: Write the failing test** — `src/examples/multi-armed-bandit/__tests__/scene.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { computeLayout, characterX } from "../scene";

describe("scene layout", () => {
  it("spreads stores across the usable width in order", () => {
    const l = computeLayout(1000, 400, 3);
    expect(l.storeXs).toHaveLength(3);
    expect(l.storeXs[0]).toBeLessThan(l.storeXs[1]);
    expect(l.storeXs[1]).toBeLessThan(l.storeXs[2]);
    expect(l.homeX).toBeCloseTo(500, 5);
  });
});

describe("characterX", () => {
  const l = computeLayout(1000, 400, 3);

  it("is at home when idle", () => {
    expect(characterX(l, "idle", 0, 0)).toBeCloseTo(l.homeX, 5);
  });

  it("interpolates home→store while walking-to", () => {
    expect(characterX(l, "walking-to", 0, 2)).toBeCloseTo(l.homeX, 5);
    expect(characterX(l, "walking-to", 1, 2)).toBeCloseTo(l.storeXs[2], 5);
    const mid = characterX(l, "walking-to", 0.5, 2);
    expect(mid).toBeCloseTo((l.homeX + l.storeXs[2]) / 2, 5);
  });

  it("holds at the store while rating", () => {
    expect(characterX(l, "rating", 0.3, 1)).toBeCloseTo(l.storeXs[1], 5);
  });

  it("interpolates store→home while walking-back", () => {
    expect(characterX(l, "walking-back", 0, 0)).toBeCloseTo(l.storeXs[0], 5);
    expect(characterX(l, "walking-back", 1, 0)).toBeCloseTo(l.homeX, 5);
  });

  it("clamps progress to [0,1]", () => {
    expect(characterX(l, "walking-to", 2, 2)).toBeCloseTo(l.storeXs[2], 5);
    expect(characterX(l, "walking-to", -1, 2)).toBeCloseTo(l.homeX, 5);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/examples/multi-armed-bandit/__tests__/scene.test.ts`
Expected: FAIL — cannot find module `../scene`.

- [ ] **Step 3: Write the implementation** — `src/examples/multi-armed-bandit/scene.ts`

```ts
import { PALETTE, PIXEL_FONT, STORE_COLORS } from "@/shared/pixel/palette";

export type WalkPhase = "idle" | "walking-to" | "rating" | "walking-back";

export interface SceneLayout {
  width: number;
  height: number;
  homeX: number;
  groundY: number;
  storeXs: number[];
}

export interface SceneState {
  layout: SceneLayout;
  names: string[];
  counts: number[];
  phase: WalkPhase;
  progress: number;
  targetArm: number;
  lastRating: number | null;
}

function clamp01(t: number): number {
  return Math.max(0, Math.min(1, t));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * clamp01(t);
}

export function computeLayout(width: number, height: number, numStores: number): SceneLayout {
  const margin = width * 0.1;
  const usable = width - margin * 2;
  const storeXs: number[] = [];
  for (let i = 0; i < numStores; i++) {
    storeXs.push(margin + (usable * (i + 0.5)) / numStores);
  }
  return { width, height, homeX: width / 2, groundY: height * 0.82, storeXs };
}

export function characterX(
  layout: SceneLayout,
  phase: WalkPhase,
  progress: number,
  targetArm: number,
): number {
  const target = layout.storeXs[targetArm];
  switch (phase) {
    case "walking-to":
      return lerp(layout.homeX, target, progress);
    case "rating":
      return target;
    case "walking-back":
      return lerp(target, layout.homeX, progress);
    case "idle":
    default:
      return layout.homeX;
  }
}

/** Render the full scene. Not unit-tested — verified visually. */
export function drawScene(ctx: CanvasRenderingContext2D, scene: SceneState): void {
  const { layout, names, counts, phase, progress, targetArm, lastRating } = scene;
  const { width, height, groundY, storeXs } = layout;

  // sky + ground
  ctx.fillStyle = PALETTE.sky;
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = PALETTE.ground;
  ctx.fillRect(0, groundY, width, height - groundY);

  // storefronts
  const storeW = Math.min(120, (width / names.length) * 0.5);
  const storeH = storeW * 0.9;
  ctx.textAlign = "center";
  names.forEach((name, i) => {
    const x = storeXs[i];
    const top = groundY - storeH;
    ctx.fillStyle = STORE_COLORS[i % STORE_COLORS.length];
    ctx.fillRect(x - storeW / 2, top, storeW, storeH);
    // roof
    ctx.fillStyle = PALETTE.ink;
    ctx.fillRect(x - storeW / 2 - 4, top - 8, storeW + 8, 8);
    // door
    ctx.fillStyle = PALETTE.bg;
    ctx.fillRect(x - storeW * 0.15, groundY - storeH * 0.45, storeW * 0.3, storeH * 0.45);
    // label + count
    ctx.fillStyle = PALETTE.ink;
    ctx.font = `8px ${PIXEL_FONT}`;
    ctx.fillText(name, x, groundY + 18);
    ctx.fillStyle = PALETTE.accent;
    ctx.fillText(`x${counts[i]}`, x, groundY + 32);
  });

  // character
  const cx = characterX(layout, phase, progress, targetArm);
  const cy = groundY;
  drawCharacter(ctx, cx, cy, phase, progress);

  // rating popup
  if (phase === "rating" && lastRating != null) {
    drawStars(ctx, storeXs[targetArm], groundY - storeH - 28, lastRating);
  }
}

function drawCharacter(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  phase: WalkPhase,
  progress: number,
): void {
  const bob = phase === "walking-to" || phase === "walking-back"
    ? Math.sin(progress * Math.PI * 8) * 2
    : 0;
  const px = Math.round(x);
  const py = Math.round(y - 24 + bob);
  // body
  ctx.fillStyle = PALETTE.body;
  ctx.fillRect(px - 6, py, 12, 16);
  // head
  ctx.fillStyle = PALETTE.skin;
  ctx.fillRect(px - 5, py - 10, 10, 10);
  // legs
  ctx.fillStyle = PALETTE.ink;
  ctx.fillRect(px - 6, py + 16, 4, 6);
  ctx.fillRect(px + 2, py + 16, 4, 6);
}

function drawStars(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  rating: number,
): void {
  ctx.fillStyle = PALETTE.star;
  ctx.font = `12px ${PIXEL_FONT}`;
  ctx.textAlign = "center";
  ctx.fillText("★".repeat(rating) + "☆".repeat(3 - rating), x, y);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/examples/multi-armed-bandit/__tests__/scene.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/examples/multi-armed-bandit/scene.ts src/examples/multi-armed-bandit/__tests__/scene.test.ts
git commit -m "feat: bandit canvas scene layout and renderer"
```

---

## Task 9: Shared UI components

**Files:**
- Create: `src/shared/ui/Toggle.tsx`, `SpeedSelector.tsx`, `PolicyTabs.tsx`, `PlaybackControls.tsx`, `ValueBar.tsx`, `TrackerPanel.tsx`, `EventLog.tsx`, `SettingsPanel.tsx`
- Test: `src/shared/ui/__tests__/SpeedSelector.test.tsx`, `PolicyTabs.test.tsx`, `ValueBar.test.tsx`, `PlaybackControls.test.tsx`

**Interfaces:**
- Produces:
  - `SPEEDS: number[]` and `<SpeedSelector value, onChange />`
  - `POLICY_LABELS: Record<PolicyKind,string>` and `<PolicyTabs value, onChange />`
  - `<PlaybackControls isPlaying, onStepBack, onStepForward, onTogglePlay, onReset />`
  - `<ValueBar label, value, max, trueValue?, showTrue, count, color />`
  - `<TrackerPanel names, q, counts, trueValues, showTrue, max, step />`
  - `<EventLog entries />` where `entries: string[]`
  - `<SettingsPanel restaurants, onChange />` (edits distributions)
  - `<Toggle label, checked, onChange />`

- [ ] **Step 1: Write the failing tests**

`src/shared/ui/__tests__/SpeedSelector.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SpeedSelector, SPEEDS } from "../SpeedSelector";

describe("SpeedSelector", () => {
  it("renders all speed options", () => {
    render(<SpeedSelector value={1} onChange={() => {}} />);
    for (const s of SPEEDS) {
      expect(screen.getByRole("button", { name: `${s}×` })).toBeInTheDocument();
    }
  });

  it("marks the active speed as pressed", () => {
    render(<SpeedSelector value={5} onChange={() => {}} />);
    expect(screen.getByRole("button", { name: "5×" })).toHaveAttribute("aria-pressed", "true");
  });

  it("calls onChange with the chosen speed", () => {
    const onChange = vi.fn();
    render(<SpeedSelector value={1} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "10×" }));
    expect(onChange).toHaveBeenCalledWith(10);
  });

  it("exposes the required speed set", () => {
    expect(SPEEDS).toEqual([0.5, 1, 2, 5, 10, 25, 50]);
  });
});
```

`src/shared/ui/__tests__/PolicyTabs.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PolicyTabs } from "../PolicyTabs";

describe("PolicyTabs", () => {
  it("renders the four policies", () => {
    render(<PolicyTabs value="random" onChange={() => {}} />);
    for (const name of ["Random", "Greedy", "Optimistic Init", "ε-Greedy"]) {
      expect(screen.getByRole("button", { name })).toBeInTheDocument();
    }
  });

  it("calls onChange with the policy kind", () => {
    const onChange = vi.fn();
    render(<PolicyTabs value="random" onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "ε-Greedy" }));
    expect(onChange).toHaveBeenCalledWith("epsilon-greedy");
  });
});
```

`src/shared/ui/__tests__/ValueBar.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ValueBar } from "../ValueBar";

describe("ValueBar", () => {
  it("shows the label, value, and count", () => {
    render(
      <ValueBar label="A" value={2.5} max={3} count={4} color="#fff" showTrue={false} />,
    );
    expect(screen.getByText("A")).toBeInTheDocument();
    expect(screen.getByText("2.50")).toBeInTheDocument();
    expect(screen.getByText("4 visits")).toBeInTheDocument();
  });

  it("renders the fill width proportional to value/max", () => {
    render(
      <ValueBar label="A" value={1.5} max={3} count={0} color="#fff" showTrue={false} />,
    );
    const fill = screen.getByTestId("bar-fill");
    expect(fill.style.width).toBe("50%");
  });

  it("renders the true-value marker only when showTrue", () => {
    const { rerender } = render(
      <ValueBar label="A" value={1} max={3} count={0} color="#fff" showTrue={false} trueValue={2.5} />,
    );
    expect(screen.queryByTestId("true-marker")).toBeNull();
    rerender(
      <ValueBar label="A" value={1} max={3} count={0} color="#fff" showTrue trueValue={2.5} />,
    );
    expect(screen.getByTestId("true-marker")).toBeInTheDocument();
  });
});
```

`src/shared/ui/__tests__/PlaybackControls.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PlaybackControls } from "../PlaybackControls";

describe("PlaybackControls", () => {
  it("wires every button", () => {
    const fns = {
      onStepBack: vi.fn(),
      onStepForward: vi.fn(),
      onTogglePlay: vi.fn(),
      onReset: vi.fn(),
    };
    render(<PlaybackControls isPlaying={false} {...fns} />);
    fireEvent.click(screen.getByRole("button", { name: /step back/i }));
    fireEvent.click(screen.getByRole("button", { name: /step forward/i }));
    fireEvent.click(screen.getByRole("button", { name: /play/i }));
    fireEvent.click(screen.getByRole("button", { name: /reset/i }));
    expect(fns.onStepBack).toHaveBeenCalled();
    expect(fns.onStepForward).toHaveBeenCalled();
    expect(fns.onTogglePlay).toHaveBeenCalled();
    expect(fns.onReset).toHaveBeenCalled();
  });

  it("shows Pause while playing", () => {
    render(
      <PlaybackControls
        isPlaying
        onStepBack={() => {}}
        onStepForward={() => {}}
        onTogglePlay={() => {}}
        onReset={() => {}}
      />,
    );
    expect(screen.getByRole("button", { name: /pause/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run src/shared/ui`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement the components**

`src/shared/ui/SpeedSelector.tsx`:

```tsx
export const SPEEDS: number[] = [0.5, 1, 2, 5, 10, 25, 50];

export function SpeedSelector({
  value,
  onChange,
}: {
  value: number;
  onChange: (speed: number) => void;
}) {
  return (
    <div className="speed-selector" role="group" aria-label="Speed">
      {SPEEDS.map((s) => (
        <button
          key={s}
          aria-pressed={s === value}
          onClick={() => onChange(s)}
        >
          {s}×
        </button>
      ))}
    </div>
  );
}
```

`src/shared/ui/PolicyTabs.tsx`:

```tsx
import type { PolicyKind } from "@/shared/rl/policies";

export const POLICY_LABELS: Record<PolicyKind, string> = {
  random: "Random",
  greedy: "Greedy",
  optimistic: "Optimistic Init",
  "epsilon-greedy": "ε-Greedy",
};

const ORDER: PolicyKind[] = ["random", "greedy", "optimistic", "epsilon-greedy"];

export function PolicyTabs({
  value,
  onChange,
}: {
  value: PolicyKind;
  onChange: (kind: PolicyKind) => void;
}) {
  return (
    <div className="policy-tabs" role="tablist">
      {ORDER.map((kind) => (
        <button
          key={kind}
          className={kind === value ? "active" : ""}
          aria-pressed={kind === value}
          onClick={() => onChange(kind)}
        >
          {POLICY_LABELS[kind]}
        </button>
      ))}
    </div>
  );
}
```

`src/shared/ui/PlaybackControls.tsx`:

```tsx
export function PlaybackControls({
  isPlaying,
  onStepBack,
  onStepForward,
  onTogglePlay,
  onReset,
}: {
  isPlaying: boolean;
  onStepBack: () => void;
  onStepForward: () => void;
  onTogglePlay: () => void;
  onReset: () => void;
}) {
  return (
    <div className="playback-controls" role="group" aria-label="Playback">
      <button onClick={onStepBack} aria-label="Step back">◀ Back</button>
      <button onClick={onTogglePlay} aria-label={isPlaying ? "Pause" : "Play"}>
        {isPlaying ? "❚❚ Pause" : "▶ Play"}
      </button>
      <button onClick={onStepForward} aria-label="Step forward">Step ▶</button>
      <button onClick={onReset} aria-label="Reset">⟲ Reset</button>
    </div>
  );
}
```

`src/shared/ui/ValueBar.tsx`:

```tsx
export function ValueBar({
  label,
  value,
  max,
  count,
  color,
  showTrue,
  trueValue,
}: {
  label: string;
  value: number;
  max: number;
  count: number;
  color: string;
  showTrue: boolean;
  trueValue?: number;
}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const truePct =
    trueValue != null ? Math.max(0, Math.min(100, (trueValue / max) * 100)) : 0;
  return (
    <div className="value-bar">
      <div className="value-bar__head">
        <span>{label}</span>
        <span>{value.toFixed(2)}</span>
      </div>
      <div className="value-bar__track">
        <div
          className="value-bar__fill"
          data-testid="bar-fill"
          style={{ width: `${pct}%`, background: color }}
        />
        {showTrue && trueValue != null && (
          <div
            className="value-bar__true"
            data-testid="true-marker"
            style={{ left: `${truePct}%` }}
          />
        )}
      </div>
      <div className="value-bar__count">{count} visits</div>
    </div>
  );
}
```

`src/shared/ui/TrackerPanel.tsx`:

```tsx
import { ValueBar } from "./ValueBar";
import { STORE_COLORS } from "@/shared/pixel/palette";

export function TrackerPanel({
  names,
  q,
  counts,
  trueValues,
  showTrue,
  max,
  step,
}: {
  names: string[];
  q: number[];
  counts: number[];
  trueValues: number[];
  showTrue: boolean;
  max: number;
  step: number;
}) {
  return (
    <div className="tracker-panel">
      <div className="tracker-panel__step">Step: {step}</div>
      {names.map((name, i) => (
        <ValueBar
          key={name}
          label={name}
          value={q[i]}
          max={max}
          count={counts[i]}
          color={STORE_COLORS[i % STORE_COLORS.length]}
          showTrue={showTrue}
          trueValue={trueValues[i]}
        />
      ))}
    </div>
  );
}
```

`src/shared/ui/Toggle.tsx`:

```tsx
export function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="toggle">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label}
    </label>
  );
}
```

`src/shared/ui/EventLog.tsx`:

```tsx
export function EventLog({ entries }: { entries: string[] }) {
  return (
    <div className="event-log">
      <h3>Event Log</h3>
      <ol reversed>
        {entries.slice().reverse().map((e, i) => (
          <li key={entries.length - i}>{e}</li>
        ))}
      </ol>
    </div>
  );
}
```

`src/shared/ui/SettingsPanel.tsx`:

```tsx
import type { Restaurant } from "@/examples/multi-armed-bandit/simulation";
import { trueMean } from "@/shared/rl/reward";

export function SettingsPanel({
  restaurants,
  onChange,
}: {
  restaurants: Restaurant[];
  onChange: (next: Restaurant[]) => void;
}) {
  const setProb = (ri: number, pi: number, raw: string) => {
    const v = Math.max(0, Math.min(1, Number(raw) || 0));
    const next = restaurants.map((r, i) => {
      if (i !== ri) return r;
      const dist: [number, number, number] = [...r.dist];
      dist[pi] = v;
      return { ...r, dist };
    });
    onChange(next);
  };
  return (
    <div className="settings-panel">
      <h3>True distributions</h3>
      <p>P(1★), P(2★), P(3★) per restaurant. (Should sum to 1.)</p>
      {restaurants.map((r, ri) => (
        <div key={r.name} className="settings-row">
          <span>{r.name}</span>
          {[0, 1, 2].map((pi) => (
            <input
              key={pi}
              type="number"
              step="0.05"
              min="0"
              max="1"
              value={r.dist[pi]}
              aria-label={`${r.name} P(${pi + 1} star)`}
              onChange={(e) => setProb(ri, pi, e.target.value)}
            />
          ))}
          <span>mean {trueMean(r.dist).toFixed(2)}</span>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run src/shared/ui`
Expected: PASS (all SpeedSelector, PolicyTabs, ValueBar, PlaybackControls tests).

- [ ] **Step 5: Commit**

```bash
git add src/shared/ui
git commit -m "feat: shared UI components (controls, tabs, trackers, settings)"
```

---

## Task 10: Bandit example integration + animation loop

**Files:**
- Create: `src/examples/multi-armed-bandit/restaurants.ts`
- Replace: `src/examples/multi-armed-bandit/BanditExample.tsx` (the Task 1 stub)
- Append CSS: `src/styles.css`
- Test: `src/examples/multi-armed-bandit/__tests__/restaurants.test.ts`

**Interfaces:**
- Consumes: everything from Tasks 2–9.
- Produces:
  - `restaurants.ts`: `DEFAULT_RESTAURANTS: Restaurant[]`, `DEFAULT_EPSILON = 0.1`, `DEFAULT_OPTIMISTIC_INIT = 4`, `DEFAULT_SEED = 12345`, `MAX_VALUE = 3`.
  - `BanditExample` route component.
- Animation model: on each committed step, run a walk cycle (`walking-to` → `rating` → `walking-back` → `idle`). Base cycle duration is scaled by `1/speed`. While `isPlaying`, the next step auto-fires when the cycle returns to `idle`.

- [ ] **Step 1: Write the failing test** — `src/examples/multi-armed-bandit/__tests__/restaurants.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { DEFAULT_RESTAURANTS, MAX_VALUE } from "../restaurants";
import { trueMean } from "@/shared/rl/reward";

describe("default restaurants", () => {
  it("are ordered Claudette > Banquise > Poutineville by true mean", () => {
    const [a, b, c] = DEFAULT_RESTAURANTS.map((r) => trueMean(r.dist));
    expect(a).toBeGreaterThan(b);
    expect(b).toBeGreaterThan(c);
  });

  it("has the expected means", () => {
    const means = DEFAULT_RESTAURANTS.map((r) => Number(trueMean(r.dist).toFixed(2)));
    expect(means).toEqual([2.5, 2.2, 1.7]);
  });

  it("max value is 3", () => {
    expect(MAX_VALUE).toBe(3);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/examples/multi-armed-bandit/__tests__/restaurants.test.ts`
Expected: FAIL — cannot find module `../restaurants`.

- [ ] **Step 3: Write `restaurants.ts`**

```ts
import type { Restaurant } from "./simulation";

export const DEFAULT_RESTAURANTS: Restaurant[] = [
  { name: "Chez Claudette", dist: [0.1, 0.3, 0.6] },
  { name: "La Banquise", dist: [0.2, 0.4, 0.4] },
  { name: "Poutineville", dist: [0.5, 0.3, 0.2] },
];

export const DEFAULT_EPSILON = 0.1;
export const DEFAULT_OPTIMISTIC_INIT = 4;
export const DEFAULT_SEED = 12345;
export const MAX_VALUE = 3;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/examples/multi-armed-bandit/__tests__/restaurants.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Implement `BanditExample.tsx`** (replace the stub)

```tsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import type { PolicyKind } from "@/shared/rl/policies";
import { trueMean } from "@/shared/rl/reward";
import { fitCanvas } from "@/shared/pixel/canvas";
import { PolicyTabs } from "@/shared/ui/PolicyTabs";
import { PlaybackControls } from "@/shared/ui/PlaybackControls";
import { SpeedSelector } from "@/shared/ui/SpeedSelector";
import { TrackerPanel } from "@/shared/ui/TrackerPanel";
import { EventLog } from "@/shared/ui/EventLog";
import { SettingsPanel } from "@/shared/ui/SettingsPanel";
import { Toggle } from "@/shared/ui/Toggle";
import {
  createSim,
  derive,
  reset as resetSim,
  stepBack,
  stepForward,
  type Restaurant,
  type SimConfig,
  type SimState,
} from "./simulation";
import {
  computeLayout,
  drawScene,
  type SceneState,
  type WalkPhase,
} from "./scene";
import {
  DEFAULT_EPSILON,
  DEFAULT_OPTIMISTIC_INIT,
  DEFAULT_RESTAURANTS,
  DEFAULT_SEED,
  MAX_VALUE,
} from "./restaurants";

const BASE_CYCLE_MS = 1400; // full walk-to + rate + walk-back at 1×
const SCENE_W = 960;
const SCENE_H = 360;

interface Anim {
  phase: WalkPhase;
  progress: number;
  targetArm: number;
  lastRating: number | null;
}

const IDLE: Anim = { phase: "idle", progress: 0, targetArm: 0, lastRating: null };

export function BanditExample() {
  const [policy, setPolicy] = useState<PolicyKind>("random");
  const [epsilon, setEpsilon] = useState(DEFAULT_EPSILON);
  const [optimisticInit, setOptimisticInit] = useState(DEFAULT_OPTIMISTIC_INIT);
  const [restaurants, setRestaurants] = useState<Restaurant[]>(DEFAULT_RESTAURANTS);
  const [showTrue, setShowTrue] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);

  // simulation state lives in a ref (mutated imperatively); a tick forces re-render
  const config: SimConfig = useMemo(
    () => ({ restaurants, policy, epsilon, optimisticInit, seed: DEFAULT_SEED }),
    [restaurants, policy, epsilon, optimisticInit],
  );
  const simRef = useRef<SimState>(createSim(config));
  const animRef = useRef<Anim>(IDLE);
  const [, forceTick] = useState(0);
  const rerender = useCallback(() => forceTick((t) => t + 1), []);
  const [log, setLog] = useState<string[]>([]);

  // auto-reset whenever config changes (policy / epsilon / init / distributions)
  useEffect(() => {
    simRef.current = createSim(config);
    animRef.current = IDLE;
    setLog([]);
    setIsPlaying(false);
    rerender();
  }, [config, rerender]);

  const derived = derive(simRef.current);
  const names = restaurants.map((r) => r.name);
  const trueValues = restaurants.map((r) => trueMean(r.dist));

  const commitStep = useCallback(() => {
    const { state, record } = stepForward(simRef.current);
    simRef.current = state;
    animRef.current = {
      phase: "walking-to",
      progress: 0,
      targetArm: record.arm,
      lastRating: record.reward,
    };
    setLog((l) => [
      ...l,
      `Step ${state.pointer}: visited ${names[record.arm]} → ${record.reward}★`,
    ]);
    rerender();
  }, [names, rerender]);

  const handleStepBack = useCallback(() => {
    setIsPlaying(false);
    simRef.current = stepBack(simRef.current);
    animRef.current = IDLE;
    setLog((l) => l.slice(0, simRef.current.pointer));
    rerender();
  }, [rerender]);

  const handleReset = useCallback(() => {
    setIsPlaying(false);
    simRef.current = resetSim(simRef.current);
    animRef.current = IDLE;
    setLog([]);
    rerender();
  }, [rerender]);

  // animation loop: advances the current walk cycle; auto-steps when playing
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const lastTsRef = useRef<number | null>(null);
  useEffect(() => {
    let raf = 0;
    const tick = (ts: number) => {
      const last = lastTsRef.current ?? ts;
      const dt = ts - last;
      lastTsRef.current = ts;

      const cycle = BASE_CYCLE_MS / speed;
      const a = animRef.current;
      if (a.phase !== "idle") {
        const step = dt / (cycle / 3); // three phases share the cycle
        let progress = a.progress + step;
        let phase = a.phase;
        while (progress >= 1 && phase !== "idle") {
          progress -= 1;
          phase = nextPhase(phase);
        }
        animRef.current =
          phase === "idle"
            ? { ...a, phase: "idle", progress: 0 }
            : { ...a, phase, progress };
      } else if (isPlaying) {
        commitStep();
      }

      const canvas = canvasRef.current;
      if (canvas) {
        const dpr = window.devicePixelRatio || 1;
        const dims = fitCanvas(canvas, SCENE_W, SCENE_H, dpr);
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.setTransform(dims.width / SCENE_W, 0, 0, dims.height / SCENE_H, 0, 0);
          const cur = animRef.current;
          const scene: SceneState = {
            layout: computeLayout(SCENE_W, SCENE_H, names.length),
            names,
            counts: derive(simRef.current).counts,
            phase: cur.phase,
            progress: cur.progress,
            targetArm: cur.targetArm,
            lastRating: cur.phase === "rating" ? cur.lastRating : null,
          };
          drawScene(ctx, scene);
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      lastTsRef.current = null;
    };
  }, [speed, isPlaying, commitStep, names]);

  return (
    <div className="app bandit">
      <p><Link to="/">← All demos</Link></p>
      <h1>Multi-Armed Bandit: Best Poutine in Montréal</h1>

      <PolicyTabs value={policy} onChange={setPolicy} />

      <div className="param-bar">
        {policy === "epsilon-greedy" && (
          <label>
            ε = {epsilon.toFixed(2)}
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={epsilon}
              onChange={(e) => setEpsilon(Number(e.target.value))}
            />
          </label>
        )}
        {policy === "optimistic" && (
          <label>
            Init value
            <input
              type="number"
              step="0.5"
              value={optimisticInit}
              onChange={(e) => setOptimisticInit(Number(e.target.value))}
            />
          </label>
        )}
        <Toggle label="Show true value" checked={showTrue} onChange={setShowTrue} />
        <Toggle label="Event log" checked={showLog} onChange={setShowLog} />
        <button onClick={() => setShowSettings((s) => !s)} aria-label="Settings">⚙</button>
      </div>

      <canvas ref={canvasRef} aria-label="Bandit animation" />

      <div className="controls-row">
        <PlaybackControls
          isPlaying={isPlaying}
          onStepBack={handleStepBack}
          onStepForward={() => {
            setIsPlaying(false);
            commitStep();
          }}
          onTogglePlay={() => setIsPlaying((p) => !p)}
          onReset={handleReset}
        />
        <SpeedSelector value={speed} onChange={setSpeed} />
      </div>

      <TrackerPanel
        names={names}
        q={derived.q}
        counts={derived.counts}
        trueValues={trueValues}
        showTrue={showTrue}
        max={MAX_VALUE}
        step={derived.step}
      />

      {showLog && <EventLog entries={log} />}
      {showSettings && (
        <SettingsPanel restaurants={restaurants} onChange={setRestaurants} />
      )}
    </div>
  );
}

function nextPhase(phase: WalkPhase): WalkPhase {
  switch (phase) {
    case "walking-to":
      return "rating";
    case "rating":
      return "walking-back";
    case "walking-back":
      return "idle";
    default:
      return "idle";
  }
}
```

- [ ] **Step 6: Append component CSS to `src/styles.css`**

```css
.bandit h1 { font-size: 16px; }
.policy-tabs, .playback-controls, .speed-selector { display: flex; gap: 6px; flex-wrap: wrap; }
.param-bar { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; margin: 12px 0; }
.param-bar label { display: flex; gap: 6px; align-items: center; }
.controls-row { display: flex; gap: 16px; justify-content: space-between; flex-wrap: wrap; margin: 12px 0; }
.tracker-panel { display: grid; gap: 12px; margin-top: 16px; }
.tracker-panel__step { color: var(--accent); }
.value-bar__head { display: flex; justify-content: space-between; }
.value-bar__track { position: relative; height: 18px; background: var(--panel); border: 2px solid var(--ink); }
.value-bar__fill { height: 100%; }
.value-bar__true { position: absolute; top: -3px; bottom: -3px; width: 3px; background: var(--ink); }
.value-bar__count { font-size: 10px; color: var(--mid); }
.event-log { margin-top: 16px; max-height: 200px; overflow: auto; background: var(--panel); padding: 8px; }
.event-log li { font-size: 10px; }
.settings-panel { margin-top: 16px; background: var(--panel); padding: 12px; }
.settings-row { display: flex; gap: 8px; align-items: center; margin: 6px 0; }
.settings-row input { width: 60px; }
.toggle { display: flex; gap: 4px; align-items: center; }
```

- [ ] **Step 7: Verify the full app**

Run: `pnpm test`
Expected: ALL tests pass.
Run: `pnpm typecheck`
Expected: no type errors.
Run: `pnpm dev`, open `/multi-armed-bandit`, and manually verify:
- Character walks to a restaurant, shows stars, walks back; the chosen restaurant's bar and count update.
- Step ▶ advances one visit; ◀ Back rewinds one (bar/count/step decrease); Play auto-runs; Reset clears.
- Speed buttons change run/animation speed; walk keeps playing (faster) at 50×.
- Switching policy tabs auto-resets. ε slider appears only for ε-Greedy; Init value only for Optimistic. Changing either auto-resets.
- "Show true value" toggles the markers; "Event log" shows the log; ⚙ shows the distribution editor and editing a probability auto-resets.
- Let Greedy run several times via Reset — observe it sometimes locking onto a suboptimal restaurant. Optimistic (init 4) and ε-Greedy converge to Chez Claudette.
Stop the server.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: wire bandit example with animation, controls, and trackers"
```

---

## Task 11: Documentation (README, AGENTS.md, CLAUDE.md)

**Files:**
- Modify: `README.md`
- Create: `AGENTS.md`, `CLAUDE.md`

**Interfaces:** None (docs only).

- [ ] **Step 1: Write `README.md`**

```markdown
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

## Adding a new example

1. Create `src/examples/<name>/` with its `simulation.ts`, `scene.ts`, and `<Name>Example.tsx`.
2. Add a route in `src/main.tsx`.
3. Add a card to `EXAMPLES` in `src/pages/Landing.tsx`.

See `AGENTS.md` for deeper architecture notes.
```

- [ ] **Step 2: Write `AGENTS.md`**

```markdown
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
```

- [ ] **Step 3: Write `CLAUDE.md`**

```markdown
@AGENTS.md
```

- [ ] **Step 4: Verify docs commands**

Run: `pnpm install` (confirm README quickstart is accurate)
Run: `pnpm test` (confirm passes)
Run: `pnpm build` (confirm static build succeeds)

- [ ] **Step 5: Commit**

```bash
git add README.md AGENTS.md CLAUDE.md
git commit -m "docs: add README, AGENTS.md, and CLAUDE.md"
```

---

## Self-Review

**1. Spec coverage:**
- Stack & structure (Vite+React+TS, pnpm, router, shared dirs) → Task 1, file structure. ✓
- Reward model (categorical, defaults, editable in hidden settings) → Tasks 4, 9 (SettingsPanel), 10. ✓
- Estimation (sample average, optimistic init) → Tasks 3, 6. ✓
- Four policies, tabs, contextual params, auto-reset → Tasks 5, 9 (PolicyTabs), 10. ✓
- Controls: step/step-back/play/reset, speed options set → Tasks 9, 10. ✓
- Displays: value bars, counts, toggleable true value, step counter, hidden event log → Tasks 9, 10. ✓
- Animation: pixel street, walk-to/rate/walk-back, retro font/palette → Tasks 7, 8, 10. ✓
- Trajectory + seeded RNG for rewind/replay → Tasks 2, 6. ✓
- Settings panel (hidden, edits distributions) → Tasks 9, 10. ✓
- High-speed: walk keeps playing faster (no snapping) → Task 10 (cycle scaled by 1/speed). ✓
- Docs: README, AGENTS.md, CLAUDE.md re-export → Task 11. ✓
- Landing page + example card → Tasks 1, 11. ✓

**2. Placeholder scan:** No TBD/TODO; the only stub (BanditExample in Task 1) is explicitly flagged and fully replaced in Task 10. ✓

**3. Type consistency:** `Restaurant`/`SimConfig`/`SimState`/`StepRecord`/`DerivedState` defined in Task 6 and reused consistently in Tasks 9–10. `PolicyKind` from Task 5 used in Tasks 6, 9, 10. `Categorical` from Task 4 used in Tasks 6, 9. `SceneState`/`WalkPhase`/`computeLayout`/`characterX`/`drawScene` from Task 8 used in Task 10. `fitCanvas` from Task 7 used in Task 10. `SPEEDS` matches the required speed set. ✓
```

