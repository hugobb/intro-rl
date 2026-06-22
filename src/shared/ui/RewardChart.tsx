import { useEffect, useRef } from "react";
import { fitCanvas } from "@/shared/pixel/canvas";
import { PALETTE, PIXEL_FONT } from "@/shared/pixel/palette";
import {
  CHART_METRICS,
  chartBounds,
  metricSeries,
  metricYMax,
  projectPoint,
  type ChartMetric,
  type RunData,
} from "./chart";

const CW = 380;
const CH = 240;
const PAD = 30;

interface Plotted {
  run: RunData;
  series: number[];
}

const legendRowClass =
  "flex flex-1 items-center gap-1.5 border-0 bg-transparent p-1 text-left text-[9px] text-ink hover:bg-bg hover:text-ink";
const swatchClass = "inline-block h-2.5 w-2.5 shrink-0 border border-ink";

export function RewardChart({
  savedRuns,
  liveRun,
  selectedId,
  onSelect,
  onDelete,
  metric,
  onMetricChange,
}: {
  savedRuns: RunData[];
  liveRun: RunData | null;
  selectedId: number | null;
  onSelect: (id: number) => void;
  onDelete: (id: number) => void;
  metric: ChartMetric;
  onMetricChange: (m: ChartMetric) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const runs = liveRun ? [...savedRuns, liveRun] : savedRuns;
  const plotted: Plotted[] = runs.map((run) => ({ run, series: metricSeries(run, metric) }));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const dims = fitCanvas(canvas, CW, CH, dpr);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dims.width / CW, 0, 0, dims.height / CH, 0, 0);
    drawChart(ctx, plotted, selectedId, metric);
  });

  const legendValue = (run: RunData): string => {
    const series = metricSeries(run, metric);
    const last = series[series.length - 1] ?? 0;
    return metric === "optimal-pct" ? `${Math.round(last)}%` : `${last}`;
  };

  const liClass = (id: number): string =>
    `flex items-center gap-1.5${selectedId === id ? " outline outline-2 outline-accent" : ""}`;

  return (
    <div className="bg-panel p-2">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <h3 className="m-0 text-[11px]">Chart</h3>
        <select
          aria-label="Chart metric"
          value={metric}
          onChange={(e) => onMetricChange(e.target.value as ChartMetric)}
        >
          {CHART_METRICS.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
      </div>
      <canvas
        ref={canvasRef}
        width={CW}
        height={CH}
        aria-label="Reward chart"
        className="block h-auto w-full"
      />
      <ul className="m-0 mt-2 grid max-h-[120px] list-none gap-1 overflow-auto p-0">
        {liveRun && (
          <li className={liClass(liveRun.id)}>
            <button className={legendRowClass} onClick={() => onSelect(liveRun.id)}>
              <span className={swatchClass} style={{ background: liveRun.color }} />
              {liveRun.label} · {legendValue(liveRun)}
            </button>
          </li>
        )}
        {savedRuns.map((r) => (
          <li key={r.id} className={liClass(r.id)}>
            <button className={legendRowClass} onClick={() => onSelect(r.id)}>
              <span className={swatchClass} style={{ background: r.color }} />
              {r.label} · {legendValue(r)}
            </button>
            <button
              className="border-0 bg-bad px-1.5 text-ink hover:bg-bad"
              aria-label={`Delete ${r.label}`}
              onClick={() => onDelete(r.id)}
            >
              ×
            </button>
          </li>
        ))}
        {savedRuns.length === 0 && !liveRun && (
          <li className="text-[9px] text-mid">Run the sim to plot.</li>
        )}
      </ul>
    </div>
  );
}

/** Render axes and one polyline per run. Not unit-tested — verified visually. */
function drawChart(
  ctx: CanvasRenderingContext2D,
  plotted: Plotted[],
  selectedId: number | null,
  metric: ChartMetric,
): void {
  ctx.clearRect(0, 0, CW, CH);
  ctx.fillStyle = PALETTE.bg;
  ctx.fillRect(0, 0, CW, CH);

  ctx.strokeStyle = PALETTE.ground;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(PAD, PAD - 6);
  ctx.lineTo(PAD, CH - PAD);
  ctx.lineTo(CW - PAD, CH - PAD);
  ctx.stroke();

  const bounds = chartBounds(plotted.map((p) => p.series));
  const yMax = metricYMax(metric) ?? bounds.yMax;
  const b = { xMax: bounds.xMax, yMax };

  ctx.fillStyle = PALETTE.ink;
  ctx.font = `8px ${PIXEL_FONT}`;
  ctx.textAlign = "right";
  ctx.fillText(metric === "optimal-pct" ? "100%" : `${yMax}`, PAD - 4, PAD);
  ctx.fillText("0", PAD - 4, CH - PAD);
  ctx.textAlign = "center";
  ctx.fillText(`${bounds.xMax} steps`, CW - PAD - 24, CH - PAD + 14);

  const anySelected =
    selectedId !== null && plotted.some((p) => p.run.id === selectedId);

  for (const { run, series } of plotted) {
    if (series.length < 2) continue;
    const dimmed = anySelected && run.id !== selectedId;
    ctx.strokeStyle = run.color;
    ctx.globalAlpha = dimmed ? 0.25 : 1;
    ctx.lineWidth = run.id === selectedId ? 3 : 1.5;
    ctx.beginPath();
    series.forEach((v, step) => {
      const { x, y } = projectPoint(step, v, b, CW, CH, PAD);
      if (step === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}
