import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  allStates,
  computeQ,
  reachableStates,
  solveV,
  type Action,
  type Policy,
  type World,
} from "@/shared/rl/gridworld";
import type { Method } from "@/shared/rl/td-estimators";
import { fitCanvas } from "@/shared/pixel/canvas";
import { PALETTE } from "@/shared/pixel/palette";
import { PlaybackControls } from "@/shared/ui/PlaybackControls";
import { SpeedSelector } from "@/shared/ui/SpeedSelector";
import { EventLog } from "@/shared/ui/EventLog";
import { Toggle } from "@/shared/ui/Toggle";
import { RUN_COLORS } from "@/shared/ui/chart";
import { MethodTabs, METHOD_LABELS } from "./MethodTabs";
import { StateValueTable } from "./StateValueTable";
import { GridSettings } from "./GridSettings";
import {
  ConvergenceChart,
  type ChartLine,
  type RmsMetric,
} from "./ConvergenceChart";
import { ValueViewTabs, type ValueView } from "./ValueViewTabs";
import { PolicyTypeTabs, type PolicyType } from "./PolicyTypeTabs";
import { ControlModeTabs, type ControlMode } from "./ControlModeTabs";
import { ReturnTracker } from "./ReturnTracker";
import { computeGridLayout, cellAtPoint, drawScene, type SceneState } from "./scene";
import {
  chooseAction,
  createSim,
  derive,
  episodeReturn,
  errorSeries,
  runEpisode,
  stepBack,
  stepForward,
  visitedStates,
  currentCell,
  type SimConfig,
  type SimState,
} from "./simulation";
import {
  DEFAULT_ALPHA,
  DEFAULT_CONTROL_MODE,
  DEFAULT_EPSILON,
  DEFAULT_GAMMA,
  DEFAULT_N,
  DEFAULT_POLICY,
  DEFAULT_POLICY_TYPE,
  DEFAULT_SEED,
  DEFAULT_WORLD,
  SCENE_H,
  SCENE_W,
} from "./world";

const ACTION_CYCLE: Record<Action, Action> = {
  right: "down",
  down: "left",
  left: "up",
  up: "right",
};
const KEY_TO_ACTION: Record<string, Action> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
};
const BASE_STEP_MS = 320;
const EFFECT_MS = 500;

interface Anim {
  fromCell: number;
  toCell: number;
  progress: number;
}
type Effect = { kind: "crash" | "fall"; cell: number; progress: number } | null;
type RewardPop = { value: number; cell: number; progress: number } | null;

interface SavedRun {
  label: string;
  color: string;
  rmsPath: number[];
  rmsVisited: number[];
  rmsAll: number[];
}

export function GridWorldExample() {
  const [method, setMethod] = useState<Method>("td0");
  const [alpha, setAlpha] = useState(DEFAULT_ALPHA);
  const [gamma, setGamma] = useState(DEFAULT_GAMMA);
  const [n, setN] = useState(DEFAULT_N);
  const [world, setWorld] = useState<World>(DEFAULT_WORLD);
  const [policy, setPolicy] = useState<Policy>(DEFAULT_POLICY);
  const [seed, setSeed] = useState(DEFAULT_SEED);
  const [policyType, setPolicyType] = useState<PolicyType>(DEFAULT_POLICY_TYPE);
  const [epsilon, setEpsilon] = useState(DEFAULT_EPSILON);
  const [controlMode, setControlMode] = useState<ControlMode>(DEFAULT_CONTROL_MODE);
  const [valueView, setValueView] = useState<ValueView>("v");
  const [showPolicy, setShowPolicy] = useState(true);
  const [showTrue, setShowTrue] = useState(false);
  const [showLog, setShowLog] = useState(true);
  const [showChart, setShowChart] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [savedRuns, setSavedRuns] = useState<SavedRun[]>([]);
  const [chartMetric, setChartMetric] = useState<RmsMetric>("path");
  const runIdRef = useRef(0);

  const config: SimConfig = useMemo(
    () => ({ world, policy, method, alpha, gamma, n, seed, policyType, epsilon, controlMode }),
    [world, policy, method, alpha, gamma, n, seed, policyType, epsilon, controlMode],
  );
  const simRef = useRef<SimState>(createSim(config));
  const animRef = useRef<Anim>({ fromCell: world.start, toCell: world.start, progress: 1 });
  const effectRef = useRef<Effect>(null);
  const popRef = useRef<RewardPop>(null);
  const [, forceTick] = useState(0);
  const rerender = useCallback(() => forceTick((t) => t + 1), []);

  const vTrue = useMemo(
    () => solveV(world, policy, gamma, policyType === "epsilon" ? epsilon : 0),
    [world, policy, gamma, policyType, epsilon],
  );
  const states = useMemo(() => reachableStates(world, policy), [world, policy]);
  const stateLabels = useMemo(
    () => states.map((s) => `r${Math.floor(s / world.cols)}c${s % world.cols}`),
    [states, world.cols],
  );
  const maxAbs = useMemo(() => Math.max(1, ...vTrue.map((x) => Math.abs(x))), [vTrue]);

  // Snapshot the previous run from ITS OWN config (no stale closure on page state).
  const snapshotRun = useCallback((sim: SimState) => {
    if (sim.pointer === 0) return;
    const c = sim.config;
    const vT = solveV(c.world, c.policy, c.gamma, c.policyType === "epsilon" ? (c.epsilon ?? 0) : 0);
    const rmsPath = errorSeries(sim, vT, reachableStates(c.world, c.policy));
    if (rmsPath.length < 2) return;
    const id = runIdRef.current++;
    setSavedRuns((prev) => [
      ...prev,
      {
        label: `Run ${id + 1} · ${METHOD_LABELS[c.method]}`,
        color: RUN_COLORS[id % RUN_COLORS.length],
        rmsPath,
        rmsVisited: errorSeries(sim, vT, visitedStates(sim)),
        rmsAll: errorSeries(sim, vT, allStates(c.world)),
      },
    ]);
  }, []);

  useEffect(() => {
    snapshotRun(simRef.current);
    simRef.current = createSim(config);
    animRef.current = { fromCell: config.world.start, toCell: config.world.start, progress: 1 };
    effectRef.current = null;
    popRef.current = null;
    setLog([]);
    setIsPlaying(false);
    rerender();
  }, [config, rerender, snapshotRun]);

  const derived = derive(simRef.current);
  const ret = episodeReturn(simRef.current);

  const liveSeries = useCallback(
    (metric: RmsMetric): number[] => {
      const sim = simRef.current;
      const set =
        metric === "path"
          ? states
          : metric === "visited"
            ? visitedStates(sim)
            : allStates(world);
      return errorSeries(sim, vTrue, set);
    },
    [states, vTrue, world],
  );

  const chartLines: ChartLine[] = useMemo(() => {
    const pick = (r: SavedRun) =>
      chartMetric === "path" ? r.rmsPath : chartMetric === "visited" ? r.rmsVisited : r.rmsAll;
    const saved = savedRuns.map((r) => ({ label: r.label, color: r.color, series: pick(r) }));
    const live = liveSeries(chartMetric);
    if (live.length < 2) return saved;
    return [
      ...saved,
      { label: `${METHOD_LABELS[method]} (current)`, color: PALETTE.accent, series: live },
    ];
    // derived.episode keeps the live line current as episodes complete
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedRuns, chartMetric, liveSeries, method, derived.episode]);

  const applyOutcome = useCallback(
    (record: { state: number; reward: number; nextState: number; done: boolean }) => {
      animRef.current = { fromCell: record.state, toCell: record.nextState, progress: 0 };
      const type = world.cells[record.nextState];
      const penalty = record.reward < -world.reward.stepCost - 1e-9;
      if (type === "road" && penalty) effectRef.current = { kind: "crash", cell: record.nextState, progress: 0 };
      else if (type === "manhole" && penalty) effectRef.current = { kind: "fall", cell: record.nextState, progress: 0 };
      if (record.reward !== 0) popRef.current = { value: record.reward, cell: record.nextState, progress: 0 };
      setLog((l) => [...l, `Step ${simRef.current.pointer} · ${stepSummary(record.reward, record.done)}`]);
      rerender();
    },
    [world, rerender],
  );

  const commitStep = useCallback(() => {
    const { state, record } = stepForward(simRef.current);
    simRef.current = state;
    applyOutcome(record);
  }, [applyOutcome]);

  const handleEpisode = useCallback(() => {
    setIsPlaying(false);
    simRef.current = runEpisode(simRef.current);
    animRef.current = { fromCell: world.start, toCell: currentCell(simRef.current), progress: 1 };
    setLog((l) => [...l, `— episode ${derive(simRef.current).episode} complete —`]);
    rerender();
  }, [rerender, world.start]);

  const handleStepBack = useCallback(() => {
    setIsPlaying(false);
    simRef.current = stepBack(simRef.current);
    setLog((l) => l.slice(0, simRef.current.pointer));
    rerender();
  }, [rerender]);

  const handleReset = useCallback(() => {
    setIsPlaying(false);
    setSeed((s) => (s + 0x9e3779b9) >>> 0);
  }, []);

  const handleCanvasClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!showPolicy) return;
      const canvas = e.currentTarget;
      const rect = canvas.getBoundingClientRect();
      const px = ((e.clientX - rect.left) / rect.width) * SCENE_W;
      const py = ((e.clientY - rect.top) / rect.height) * SCENE_H;
      const layout = computeGridLayout(SCENE_W, SCENE_H, world.rows, world.cols);
      const cell = cellAtPoint(layout, px, py);
      if (cell === null) return;
      if (world.cells[cell] === "wall" || world.cells[cell] === "restaurant") return;
      setPolicy((prev) => {
        const next = prev.slice();
        next[cell] = ACTION_CYCLE[prev[cell]];
        return next;
      });
    },
    [showPolicy, world],
  );

  // Manual mode: arrow keys drive the character.
  useEffect(() => {
    if (controlMode !== "manual") return;
    const onKey = (e: KeyboardEvent) => {
      const a = KEY_TO_ACTION[e.key];
      if (!a) return;
      e.preventDefault();
      setIsPlaying(false);
      const { state, record } = chooseAction(simRef.current, a);
      simRef.current = state;
      applyOutcome(record);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [controlMode, applyOutcome]);

  const qTrue = useMemo(() => computeQ(world, vTrue, gamma), [world, vTrue, gamma]);
  const qMaxAbs = useMemo(
    () => Math.max(1, ...qTrue.flat().map((x) => Math.abs(x))),
    [qTrue],
  );

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const lastTsRef = useRef<number | null>(null);
  useEffect(() => {
    let raf = 0;
    const tick = (ts: number) => {
      const last = lastTsRef.current ?? ts;
      const dt = ts - last;
      lastTsRef.current = ts;

      const a = animRef.current;
      if (a.progress < 1) {
        a.progress = Math.min(1, a.progress + dt / (BASE_STEP_MS / speed));
      } else if (isPlaying && controlMode === "policy") {
        commitStep();
      }
      if (effectRef.current) {
        effectRef.current.progress += dt / EFFECT_MS;
        if (effectRef.current.progress >= 1) effectRef.current = null;
      }
      if (popRef.current) {
        popRef.current.progress += dt / (EFFECT_MS + 100);
        if (popRef.current.progress >= 1) popRef.current = null;
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
            world,
            v: derive(simRef.current).v,
            policy,
            showPolicy,
            showValues: true,
            fromCell: cur.fromCell,
            toCell: cur.toCell,
            progress: cur.progress,
            maxAbs,
            valueView,
            q: valueView === "q" ? computeQ(world, derive(simRef.current).v, gamma) : undefined,
            qMaxAbs,
            effect: effectRef.current,
            rewardPop: popRef.current,
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
  }, [speed, isPlaying, controlMode, commitStep, world, policy, showPolicy, maxAbs, valueView, qMaxAbs, gamma]);

  useEffect(() => {
    if (!showSettings) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowSettings(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showSettings]);

  const manual = controlMode === "manual";

  return (
    <div className="mx-auto max-w-[1200px] p-4">
      <p>
        <Link to="/">← All demos</Link>
      </p>
      <h1 className="text-[16px]">Grid World: Policy Evaluation</h1>

      <MethodTabs value={method} onChange={setMethod} />

      <div className="my-3 flex flex-wrap items-center gap-3">
        <ValueViewTabs value={valueView} onChange={setValueView} />
        <ControlModeTabs value={controlMode} onChange={setControlMode} />
        {!manual && <PolicyTypeTabs value={policyType} onChange={setPolicyType} />}
        {!manual && policyType === "epsilon" && (
          <label className="flex items-center gap-1.5">
            ε = {epsilon.toFixed(2)}
            <input type="range" min="0" max="1" step="0.01" value={epsilon}
              onChange={(e) => setEpsilon(Number(e.target.value))} />
          </label>
        )}
      </div>

      <div className="my-3 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-1.5">
          α = {alpha.toFixed(2)}
          <input type="range" min="0.01" max="1" step="0.01" value={alpha}
            onChange={(e) => setAlpha(Number(e.target.value))} />
        </label>
        <label className="flex items-center gap-1.5">
          γ = {gamma.toFixed(2)}
          <input type="range" min="0.5" max="0.99" step="0.01" value={gamma}
            onChange={(e) => setGamma(Number(e.target.value))} />
        </label>
        {method === "nstep" && (
          <label className="flex items-center gap-1.5">
            n =
            <input type="number" min="1" max="50" step="1" value={n}
              className="w-[56px] border-2 border-ink bg-bg px-1 text-ink"
              onChange={(e) => setN(Math.max(1, Math.floor(Number(e.target.value))))} />
          </label>
        )}
        <Toggle label="Show policy" checked={showPolicy} onChange={setShowPolicy} />
        <Toggle label="Show true value" checked={showTrue} onChange={setShowTrue} />
        <Toggle label="Event log" checked={showLog} onChange={setShowLog} />
        <Toggle label="Chart" checked={showChart} onChange={setShowChart} />
        <button onClick={() => setShowSettings((s) => !s)} aria-label="Settings">
          Settings
        </button>
      </div>

      {manual ? (
        <p className="mb-2 text-[10px] text-accent">Use arrow keys to move.</p>
      ) : (
        showPolicy && (
          <p className="mb-2 text-[10px] text-accent">
            Click a cell to change its action (→ ↓ ← ↑).
          </p>
        )
      )}

      <div className="my-3 flex items-stretch gap-3">
        {showLog && (
          <div className="relative min-w-0 shrink basis-[200px]">
            <div className="absolute inset-0">
              <EventLog entries={log} />
            </div>
          </div>
        )}
        <div className="flex min-w-0 shrink grow basis-0 flex-col gap-2">
          <canvas
            ref={canvasRef}
            width={SCENE_W}
            height={SCENE_H}
            aria-label="Grid world animation"
            onClick={handleCanvasClick}
            className="block h-auto w-full"
          />
          <ReturnTracker current={ret.current} last={ret.last} />
          <div className="flex flex-wrap justify-between gap-4">
            <div className="flex flex-wrap gap-1.5">
              <PlaybackControls
                isPlaying={isPlaying}
                onStepBack={handleStepBack}
                onStepForward={() => {
                  setIsPlaying(false);
                  commitStep();
                }}
                onTogglePlay={() => setIsPlaying((p) => !p)}
                onReset={handleReset}
                manual={manual}
              />
              {!manual && (
                <button onClick={handleEpisode} aria-label="Run one episode">
                  Episode ▶▶
                </button>
              )}
            </div>
            {!manual && <SpeedSelector value={speed} onChange={setSpeed} />}
          </div>
        </div>
        {showChart && (
          <div className="min-w-0 shrink basis-[320px]">
            <ConvergenceChart
              lines={chartLines}
              metric={chartMetric}
              onMetricChange={setChartMetric}
            />
          </div>
        )}
      </div>

      <StateValueTable
        states={states}
        labels={stateLabels}
        v={derived.v}
        vTrue={vTrue}
        showTrue={showTrue}
        episode={derived.episode}
        rms={rmsOf(derived.v, vTrue, states)}
      />

      {showSettings && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setShowSettings(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Settings"
            className="max-h-[85vh] w-full max-w-[480px] overflow-auto border-2 border-ink bg-bg p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between gap-4">
              <h2 className="text-[14px]">Hazards & rewards</h2>
              <button onClick={() => setShowSettings(false)} aria-label="Close settings">
                Close
              </button>
            </div>
            <GridSettings
              reward={world.reward}
              onChange={(reward) => setWorld((w) => ({ ...w, reward }))}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function rmsOf(v: number[], vTrue: number[], states: number[]): number {
  if (states.length === 0) return 0;
  let sum = 0;
  for (const s of states) sum += (v[s] - vTrue[s]) ** 2;
  return Math.sqrt(sum / states.length);
}

function stepSummary(reward: number, done: boolean): string {
  const r = reward === 0 ? "no reward" : `reward ${reward > 0 ? "+" : ""}${reward}`;
  return done ? `${r} · reached restaurant` : r;
}
