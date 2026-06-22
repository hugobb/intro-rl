// src/examples/grid-world/ConvergenceChart.tsx
import { useEffect, useRef } from "react";
import { chartBounds, projectPoint } from "@/shared/ui/chart";
import { fitCanvas } from "@/shared/pixel/canvas";
import { PALETTE, PIXEL_FONT } from "@/shared/pixel/palette";

export interface ChartLine {
  label: string;
  color: string;
  series: number[]; // RMS error per episode (index 0 = initial)
}

const W = 320;
const H = 240;
const PAD = 28;

export function ConvergenceChart({ lines }: { lines: ChartLine[] }) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const dims = fitCanvas(canvas, W, H, dpr);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dims.width / W, 0, 0, dims.height / H, 0, 0);
    ctx.fillStyle = PALETTE.bg;
    ctx.fillRect(0, 0, W, H);

    // axes
    ctx.strokeStyle = PALETTE.ground;
    ctx.beginPath();
    ctx.moveTo(PAD, PAD);
    ctx.lineTo(PAD, H - PAD);
    ctx.lineTo(W - PAD, H - PAD);
    ctx.stroke();
    ctx.fillStyle = PALETTE.ink;
    ctx.font = `8px ${PIXEL_FONT}`;
    ctx.textAlign = "center";
    ctx.fillText("episode →", W / 2, H - 6);

    const series = lines.map((l) => l.series);
    if (series.some((s) => s.length > 1)) {
      const bounds = chartBounds(series);
      lines.forEach((line) => {
        if (line.series.length < 2) return;
        ctx.strokeStyle = line.color;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        line.series.forEach((val, step) => {
          const p = projectPoint(step, val, bounds, W, H, PAD);
          if (step === 0) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
        });
        ctx.stroke();
      });
    }
  }, [lines]);

  return (
    <div className="bg-panel p-2">
      <h3 className="mb-1 text-[11px]">RMS error vs. true V(s)</h3>
      <canvas
        ref={ref}
        width={W}
        height={H}
        aria-label="Convergence chart"
        className="block h-auto w-full"
      />
      <ul className="mt-1 flex flex-wrap gap-2 text-[9px]">
        {lines.map((l) => (
          <li key={l.label} className="flex items-center gap-1">
            <span
              className="inline-block h-2 w-3"
              style={{ backgroundColor: l.color }}
            />
            {l.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
