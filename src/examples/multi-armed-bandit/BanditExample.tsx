import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import type { PolicyKind, SelectionReason } from "@/shared/rl/policies";
import { trueMean } from "@/shared/rl/reward";
import { fitCanvas } from "@/shared/pixel/canvas";
import { PALETTE } from "@/shared/pixel/palette";
import { POLICY_LABELS, PolicyTabs } from "@/shared/ui/PolicyTabs";
import { PlaybackControls } from "@/shared/ui/PlaybackControls";
import { SpeedSelector } from "@/shared/ui/SpeedSelector";
import { TrackerPanel } from "@/shared/ui/TrackerPanel";
import { EventLog } from "@/shared/ui/EventLog";
import { SettingsPanel } from "@/shared/ui/SettingsPanel";
import { Toggle } from "@/shared/ui/Toggle";
import { RewardChart } from "@/shared/ui/RewardChart";
import { RUN_COLORS, type ChartMetric, type RunData } from "@/shared/ui/chart";
import {
  chooseArm,
  createSim,
  derive,
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
const LIVE_RUN_ID = -1; // reserved id for the in-progress run on the chart

interface Anim {
  phase: WalkPhase;
  progress: number;
  targetArm: number;
  lastRating: number | null;
}

const IDLE: Anim = {
  phase: "idle",
  progress: 0,
  targetArm: 0,
  lastRating: null,
};

export function BanditExample() {
  const [policy, setPolicy] = useState<PolicyKind>("manual");
  const [epsilon, setEpsilon] = useState(DEFAULT_EPSILON);
  const [optimisticInit, setOptimisticInit] = useState(DEFAULT_OPTIMISTIC_INIT);
  const [restaurants, setRestaurants] =
    useState<Restaurant[]>(DEFAULT_RESTAURANTS);
  const [seed, setSeed] = useState(DEFAULT_SEED);
  const [showTrue, setShowTrue] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showLog, setShowLog] = useState(true);
  const [showChart, setShowChart] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);

  const [savedRuns, setSavedRuns] = useState<RunData[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<number | null>(null);
  const [metric, setMetric] = useState<ChartMetric>("total-reward");
  const runIdRef = useRef(0);

  // simulation state lives in a ref (mutated imperatively); a tick forces re-render.
  // Seed is state so Reset can reroll it; switching policy/params keeps the seed,
  // letting you compare policies on identical luck.
  const config: SimConfig = useMemo(
    () => ({ restaurants, policy, epsilon, optimisticInit, seed }),
    [restaurants, policy, epsilon, optimisticInit, seed],
  );
  const simRef = useRef<SimState>(createSim(config));
  const animRef = useRef<Anim>(IDLE);
  const [, forceTick] = useState(0);
  const rerender = useCallback(() => forceTick((t) => t + 1), []);
  const [log, setLog] = useState<string[]>([]);

  const optimalArm = useMemo(() => {
    const means = restaurants.map((r) => trueMean(r.dist));
    return means.indexOf(Math.max(...means));
  }, [restaurants]);

  // Freeze the just-finished run (if it had any steps) into a labeled chart line.
  const snapshotRun = useCallback((sim: SimState) => {
    const applied = sim.trajectory.slice(0, sim.pointer);
    if (applied.length === 0) return; // no steps taken — nothing to save
    const means = sim.config.restaurants.map((r) => trueMean(r.dist));
    const optArm = means.indexOf(Math.max(...means));
    const id = runIdRef.current++;
    setSavedRuns((prev) => [
      ...prev,
      {
        id,
        label: `Run ${id + 1} · ${POLICY_LABELS[sim.config.policy]}`,
        color: RUN_COLORS[id % RUN_COLORS.length],
        arms: applied.map((r) => r.arm),
        rewards: applied.map((r) => r.reward),
        optimalArm: optArm,
      },
    ]);
  }, []);

  // auto-reset whenever config changes (policy / epsilon / init / distributions / seed)
  useEffect(() => {
    snapshotRun(simRef.current); // save the previous run before discarding it
    simRef.current = createSim(config);
    animRef.current = IDLE;
    setLog([]);
    setIsPlaying(false);
    rerender();
  }, [config, rerender, snapshotRun]);

  const derived = derive(simRef.current);
  // Memoized so `commitStep` and the rAF animation effect keep a stable identity
  // across per-step re-renders (otherwise the loop is torn down every step).
  const names = useMemo(() => restaurants.map((r) => r.name), [restaurants]);
  const trueValues = restaurants.map((r) => trueMean(r.dist));

  const applied = simRef.current.trajectory.slice(0, simRef.current.pointer);
  const liveRun: RunData | null =
    applied.length > 0
      ? {
          id: LIVE_RUN_ID,
          label: `${POLICY_LABELS[policy]} (current)`,
          color: PALETTE.accent,
          arms: applied.map((r) => r.arm),
          rewards: applied.map((r) => r.reward),
          optimalArm,
        }
      : null;

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
      `Step ${state.pointer} · ${reasonLabel(record.reason)} · ${names[record.arm]} → ${record.reward}★`,
    ]);
    rerender();
  }, [names, rerender]);

  // Manual mode: the user clicks a restaurant to visit it (no automated policy).
  const handleChoose = useCallback(
    (arm: number) => {
      setIsPlaying(false);
      const { state, record } = chooseArm(simRef.current, arm);
      simRef.current = state;
      animRef.current = {
        phase: "walking-to",
        progress: 0,
        targetArm: arm,
        lastRating: record.reward,
      };
      setLog((l) => [
        ...l,
        `Step ${state.pointer} · ${reasonLabel(record.reason)} · ${names[arm]} → ${record.reward}★`,
      ]);
      rerender();
    },
    [names, rerender],
  );

  const handleStepBack = useCallback(() => {
    setIsPlaying(false);
    simRef.current = stepBack(simRef.current);
    animRef.current = IDLE;
    setLog((l) => l.slice(0, simRef.current.pointer));
    rerender();
  }, [rerender]);

  // Reset rerolls the seed → the config effect snapshots the run and starts fresh.
  const handleReset = useCallback(() => {
    setIsPlaying(false);
    setSeed((s) => nextSeed(s));
  }, []);

  const handleSelectRun = useCallback((id: number) => {
    setSelectedRunId((cur) => (cur === id ? null : id)); // click again to deselect
  }, []);

  const handleDeleteRun = useCallback((id: number) => {
    setSavedRuns((prev) => prev.filter((r) => r.id !== id));
    setSelectedRunId((cur) => (cur === id ? null : cur));
  }, []);

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
        let phase: WalkPhase = a.phase;
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
          ctx.setTransform(
            dims.width / SCENE_W,
            0,
            0,
            dims.height / SCENE_H,
            0,
            0,
          );
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

  // Close the settings dialog on Escape.
  useEffect(() => {
    if (!showSettings) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowSettings(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showSettings]);

  return (
    <div className="mx-auto max-w-[1200px] p-4">
      <p>
        <Link to="/">← All demos</Link>
      </p>
      <h1 className="text-[16px]">
        Multi-Armed Bandit: Best Poutine in Montréal
      </h1>

      <PolicyTabs value={policy} onChange={setPolicy} />

      <div className="my-3 flex flex-wrap items-center gap-3">
        {policy === "epsilon-greedy" && (
          <label className="flex items-center gap-1.5">
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
          <label className="flex items-center gap-1.5">
            Init value
            <input
              type="number"
              step="0.5"
              className="w-[60px] border-2 border-ink bg-bg px-1 text-ink"
              value={optimisticInit}
              onChange={(e) => setOptimisticInit(Number(e.target.value))}
            />
          </label>
        )}
        <Toggle
          label="Show true value"
          checked={showTrue}
          onChange={setShowTrue}
        />
        <Toggle label="Event log" checked={showLog} onChange={setShowLog} />
        <Toggle label="Chart" checked={showChart} onChange={setShowChart} />
        <button
          onClick={() => setShowSettings((s) => !s)}
          aria-label="Settings"
        >
          Settings
        </button>
      </div>

      <div className="my-3 flex items-stretch gap-3">
        {showLog && (
          <div className="relative min-w-0 shrink basis-[200px]">
            {/* absolute child so a long log scrolls instead of stretching the row;
                the column height tracks the animation column via items-stretch */}
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
            aria-label="Bandit animation"
            className="block h-auto w-full"
          />
          {policy === "manual" && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] text-accent">
                Pick a restaurant:
              </span>
              {names.map((name, i) => (
                <button key={name} onClick={() => handleChoose(i)}>
                  {name}
                </button>
              ))}
            </div>
          )}
          <div className="flex flex-wrap justify-between gap-4">
            <PlaybackControls
              isPlaying={isPlaying}
              onStepBack={handleStepBack}
              onStepForward={() => {
                setIsPlaying(false);
                commitStep();
              }}
              onTogglePlay={() => setIsPlaying((p) => !p)}
              onReset={handleReset}
              manual={policy === "manual"}
            />
            <SpeedSelector value={speed} onChange={setSpeed} />
          </div>
        </div>
        {showChart && (
          <div className="min-w-0 shrink basis-[320px]">
            <RewardChart
              savedRuns={savedRuns}
              liveRun={liveRun}
              selectedId={selectedRunId}
              onSelect={handleSelectRun}
              onDelete={handleDeleteRun}
              metric={metric}
              onMetricChange={setMetric}
            />
          </div>
        )}
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

      {showSettings && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setShowSettings(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Settings"
            className="max-h-[85vh] w-full max-w-[520px] overflow-auto border-2 border-ink bg-bg p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between gap-4">
              <h2 className="text-[14px]">Settings</h2>
              <button
                onClick={() => setShowSettings(false)}
                aria-label="Close settings"
              >
                Close
              </button>
            </div>
            <SettingsPanel restaurants={restaurants} onChange={setRestaurants} />
          </div>
        </div>
      )}
    </div>
  );
}

function reasonLabel(reason: SelectionReason): string {
  if (reason === "manual") return "you chose";
  return reason === "explore" ? "random" : "best";
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

/** Derive a fresh, well-spread seed from the current one (golden-ratio step). */
function nextSeed(s: number): number {
  return (s + 0x9e3779b9) >>> 0;
}
