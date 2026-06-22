import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import type { PolicyKind } from "@/shared/rl/policies";
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
import { RUN_COLORS, type RewardRun } from "@/shared/ui/chart";
import {
  createSim,
  cumulativeReward,
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
const LIVE_RUN_ID = -1; // reserved id for the in-progress run on the chart

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
  const [showLog, setShowLog] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);

  const [savedRuns, setSavedRuns] = useState<RewardRun[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<number | null>(null);
  const runIdRef = useRef(0);

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

  // Freeze the just-finished run (if it had any steps) into a labeled chart line.
  const snapshotRun = useCallback((sim: SimState) => {
    const cumulative = cumulativeReward(sim);
    if (cumulative.length < 2) return; // no steps taken — nothing to save
    const id = runIdRef.current++;
    setSavedRuns((prev) => [
      ...prev,
      {
        id,
        label: `Run ${id + 1} · ${POLICY_LABELS[sim.config.policy]}`,
        color: RUN_COLORS[id % RUN_COLORS.length],
        cumulative,
      },
    ]);
  }, []);

  // auto-reset whenever config changes (policy / epsilon / init / distributions)
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
  // across per-step re-renders (otherwise the loop is torn down every step,
  // resetting dt and dropping a walk frame each time).
  const names = useMemo(() => restaurants.map((r) => r.name), [restaurants]);
  const trueValues = restaurants.map((r) => trueMean(r.dist));

  const liveCumulative = cumulativeReward(simRef.current);
  const liveRun: RewardRun | null =
    liveCumulative.length > 1
      ? {
          id: LIVE_RUN_ID,
          label: `${POLICY_LABELS[policy]} (current)`,
          color: PALETTE.accent,
          cumulative: liveCumulative,
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
    const why = record.reason === "explore" ? "🎲 random" : "★ best";
    setLog((l) => [
      ...l,
      `Step ${state.pointer} · ${why} · ${names[record.arm]} → ${record.reward}★`,
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
    snapshotRun(simRef.current); // save the finished run to the chart
    simRef.current = resetSim(simRef.current);
    animRef.current = IDLE;
    setLog([]);
    rerender();
  }, [rerender, snapshotRun]);

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
      <p>
        <Link to="/">← All demos</Link>
      </p>
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
        <button onClick={() => setShowSettings((s) => !s)} aria-label="Settings">
          ⚙
        </button>
      </div>

      <div className="bandit-stage">
        {showLog && <EventLog entries={log} />}
        <div className="bandit-center">
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
        </div>
        <RewardChart
          savedRuns={savedRuns}
          liveRun={liveRun}
          selectedId={selectedRunId}
          onSelect={handleSelectRun}
          onDelete={handleDeleteRun}
        />
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
