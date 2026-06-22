import { useEffect, useRef } from "react";
import { fitCanvas } from "@/shared/pixel/canvas";
import { PALETTE, PIXEL_FONT } from "@/shared/pixel/palette";
import { chartBounds, projectPoint, type RewardRun } from "./chart";

const CW = 380;
const CH = 240;
const PAD = 30;

export function RewardChart({
  savedRuns,
  liveRun,
  selectedId,
  onSelect,
  onDelete,
}: {
  savedRuns: RewardRun[];
  liveRun: RewardRun | null;
  selectedId: number | null;
  onSelect: (id: number) => void;
  onDelete: (id: number) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const dims = fitCanvas(canvas, CW, CH, dpr);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dims.width / CW, 0, 0, dims.height / CH, 0, 0);
    const runs = liveRun ? [...savedRuns, liveRun] : savedRuns;
    drawChart(ctx, runs, selectedId);
  }, [savedRuns, liveRun, selectedId]);

  return (
    <div className="reward-chart">
      <h3>Total reward vs. steps</h3>
      <canvas ref={canvasRef} aria-label="Cumulative reward chart" />
      <ul className="reward-chart__legend">
        {liveRun && (
          <li className={selectedId === liveRun.id ? "selected" : ""}>
            <button className="legend-row" onClick={() => onSelect(liveRun.id)}>
              <span className="swatch" style={{ background: liveRun.color }} />
              {liveRun.label} · {liveRun.cumulative[liveRun.cumulative.length - 1] ?? 0}
            </button>
          </li>
        )}
        {savedRuns.map((r) => (
          <li key={r.id} className={selectedId === r.id ? "selected" : ""}>
            <button className="legend-row" onClick={() => onSelect(r.id)}>
              <span className="swatch" style={{ background: r.color }} />
              {r.label} · {r.cumulative[r.cumulative.length - 1] ?? 0}
            </button>
            <button
              className="legend-del"
              aria-label={`Delete ${r.label}`}
              onClick={() => onDelete(r.id)}
            >
              ×
            </button>
          </li>
        ))}
        {savedRuns.length === 0 && !liveRun && (
          <li className="reward-chart__empty">Run the sim to plot reward.</li>
        )}
      </ul>
    </div>
  );
}

/** Render axes and one polyline per run. Not unit-tested — verified visually. */
function drawChart(
  ctx: CanvasRenderingContext2D,
  runs: RewardRun[],
  selectedId: number | null,
): void {
  ctx.clearRect(0, 0, CW, CH);
  ctx.fillStyle = PALETTE.bg;
  ctx.fillRect(0, 0, CW, CH);

  // axes
  ctx.strokeStyle = PALETTE.ground;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(PAD, PAD - 6);
  ctx.lineTo(PAD, CH - PAD);
  ctx.lineTo(CW - PAD, CH - PAD);
  ctx.stroke();

  const bounds = chartBounds(runs.map((r) => r.cumulative));

  ctx.fillStyle = PALETTE.ink;
  ctx.font = `8px ${PIXEL_FONT}`;
  ctx.textAlign = "right";
  ctx.fillText(`${bounds.yMax}`, PAD - 4, PAD);
  ctx.fillText("0", PAD - 4, CH - PAD);
  ctx.textAlign = "center";
  ctx.fillText(`${bounds.xMax} steps`, CW - PAD - 24, CH - PAD + 14);

  const anySelected = selectedId !== null && runs.some((r) => r.id === selectedId);

  for (const run of runs) {
    if (run.cumulative.length < 2) continue;
    const dimmed = anySelected && run.id !== selectedId;
    ctx.strokeStyle = run.color;
    ctx.globalAlpha = dimmed ? 0.25 : 1;
    ctx.lineWidth = run.id === selectedId ? 3 : 1.5;
    ctx.beginPath();
    run.cumulative.forEach((v, step) => {
      const { x, y } = projectPoint(step, v, bounds, CW, CH, PAD);
      if (step === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}
