// src/examples/grid-world/scene.ts
import { PALETTE, PIXEL_FONT } from "@/shared/pixel/palette";
import type { Action, Policy, World } from "@/shared/rl/gridworld";

export interface GridLayout {
  width: number;
  height: number;
  cell: number;
  originX: number;
  originY: number;
  rows: number;
  cols: number;
}

export interface CellRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function computeGridLayout(
  width: number,
  height: number,
  rows: number,
  cols: number,
): GridLayout {
  const cell = Math.floor(Math.min(width / cols, height / rows));
  const gridW = cell * cols;
  const gridH = cell * rows;
  return {
    width,
    height,
    cell,
    originX: Math.floor((width - gridW) / 2),
    originY: Math.floor((height - gridH) / 2),
    rows,
    cols,
  };
}

export function cellRect(layout: GridLayout, index: number): CellRect {
  const row = Math.floor(index / layout.cols);
  const col = index % layout.cols;
  return {
    x: layout.originX + col * layout.cell,
    y: layout.originY + row * layout.cell,
    w: layout.cell,
    h: layout.cell,
  };
}

export function cellAtPoint(
  layout: GridLayout,
  px: number,
  py: number,
): number | null {
  const col = Math.floor((px - layout.originX) / layout.cell);
  const row = Math.floor((py - layout.originY) / layout.cell);
  if (col < 0 || col >= layout.cols || row < 0 || row >= layout.rows) return null;
  return row * layout.cols + col;
}

function lerpChannel(a: number, b: number, t: number): number {
  return Math.round(a + (b - a) * Math.max(0, Math.min(1, t)));
}

/** Diverging heatmap: red (negative) → neutral (0) → green (positive). */
export function heatColor(v: number, maxAbs: number): string {
  const neutral: [number, number, number] = [40, 44, 60];
  const good: [number, number, number] = [56, 183, 100]; // PALETTE.good
  const bad: [number, number, number] = [239, 125, 87]; // PALETTE.bad
  if (maxAbs <= 0) return `rgb(${neutral[0]},${neutral[1]},${neutral[2]})`;
  const t = Math.max(-1, Math.min(1, v / maxAbs));
  const target = t >= 0 ? good : bad;
  const m = Math.abs(t);
  const r = lerpChannel(neutral[0], target[0], m);
  const g = lerpChannel(neutral[1], target[1], m);
  const b = lerpChannel(neutral[2], target[2], m);
  return `rgb(${r},${g},${b})`;
}

const CELL_LABEL: Partial<Record<string, string>> = {
  manhole: "◳",
  poutine: "★",
  crosswalk: "≡",
  road: "≈",
  start: "▷",
  restaurant: "🍴",
};

const ARROW: Record<Action, string> = {
  up: "↑",
  down: "↓",
  left: "←",
  right: "→",
};

export interface SceneState {
  world: World;
  v: number[];
  policy: Policy;
  showPolicy: boolean;
  showValues: boolean;
  fromCell: number;
  toCell: number;
  progress: number; // 0..1 along from→to
  maxAbs: number;
}

/** Render the full grid scene. Not unit-tested — verified visually. */
export function drawScene(ctx: CanvasRenderingContext2D, scene: SceneState): void {
  const { world, v, policy, showPolicy, showValues, maxAbs } = scene;
  const layout = computeGridLayout(scene.world.cols * 80, scene.world.rows * 80, world.rows, world.cols);
  ctx.fillStyle = PALETTE.bg;
  ctx.fillRect(0, 0, layout.width, layout.height);

  for (let i = 0; i < world.cells.length; i++) {
    const rect = cellRect(layout, i);
    const type = world.cells[i];
    // base fill: walls dark, others get the value heatmap
    ctx.fillStyle =
      type === "wall" ? "#05060f" : heatColor(v[i] ?? 0, maxAbs);
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    ctx.strokeStyle = PALETTE.sky;
    ctx.strokeRect(rect.x + 0.5, rect.y + 0.5, rect.w - 1, rect.h - 1);

    if (type !== "wall" && type !== "empty") {
      ctx.fillStyle = PALETTE.ink;
      ctx.font = `12px ${PIXEL_FONT}`;
      ctx.textAlign = "center";
      ctx.fillText(CELL_LABEL[type] ?? "", rect.x + rect.w / 2, rect.y + 16);
    }

    if (showValues && type !== "wall") {
      ctx.fillStyle = PALETTE.ink;
      ctx.font = `9px ${PIXEL_FONT}`;
      ctx.textAlign = "center";
      ctx.fillText((v[i] ?? 0).toFixed(1), rect.x + rect.w / 2, rect.y + rect.h - 8);
    }

    if (showPolicy && type !== "wall" && type !== "restaurant") {
      ctx.fillStyle = PALETTE.accent;
      ctx.font = `16px ${PIXEL_FONT}`;
      ctx.textAlign = "center";
      ctx.fillText(ARROW[policy[i]], rect.x + rect.w / 2, rect.y + rect.h / 2 + 6);
    }
  }

  // character interpolated from fromCell to toCell
  const from = cellRect(layout, scene.fromCell);
  const to = cellRect(layout, scene.toCell);
  const t = Math.max(0, Math.min(1, scene.progress));
  const cx = lerp(from.x, to.x, t) + from.w / 2;
  const cy = lerp(from.y, to.y, t) + from.h / 2;
  ctx.fillStyle = PALETTE.body;
  ctx.fillRect(Math.round(cx - 8), Math.round(cy - 10), 16, 20);
  ctx.fillStyle = PALETTE.skin;
  ctx.fillRect(Math.round(cx - 6), Math.round(cy - 18), 12, 10);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
