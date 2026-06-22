// src/examples/grid-world/scene.ts
import { PALETTE, PIXEL_FONT } from "@/shared/pixel/palette";
import { ACTIONS, type Action, type Policy, type World } from "@/shared/rl/gridworld";

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
  valueView?: "v" | "q";
  q?: number[][]; // [cell][actionIndex] when valueView==="q"
  qMaxAbs?: number;
  effect?: { kind: "crash" | "fall"; cell: number; progress: number } | null;
  rewardPop?: { value: number; cell: number; progress: number } | null;
}

/** The triangular quadrant for `action` within a cell: two cell corners + the center. */
export function cellQuadrant(
  layout: GridLayout,
  cell: number,
  action: Action,
): { x: number; y: number }[] {
  const r = cellRect(layout, cell);
  const c = { x: r.x + r.w / 2, y: r.y + r.h / 2 };
  const tl = { x: r.x, y: r.y };
  const tr = { x: r.x + r.w, y: r.y };
  const br = { x: r.x + r.w, y: r.y + r.h };
  const bl = { x: r.x, y: r.y + r.h };
  switch (action) {
    case "up":
      return [tl, tr, c];
    case "right":
      return [tr, br, c];
    case "down":
      return [br, bl, c];
    case "left":
      return [bl, tl, c];
  }
}

/** Render the full grid scene. Not unit-tested — verified visually. */
export function drawScene(ctx: CanvasRenderingContext2D, scene: SceneState): void {
  const { world, v, policy, showPolicy, showValues, maxAbs } = scene;
  const valueView = scene.valueView ?? "v";
  const layout = computeGridLayout(world.cols * 80, world.rows * 80, world.rows, world.cols);
  ctx.fillStyle = PALETTE.bg;
  ctx.fillRect(0, 0, layout.width, layout.height);

  for (let i = 0; i < world.cells.length; i++) {
    const rect = cellRect(layout, i);
    const type = world.cells[i];

    if (type === "wall") {
      ctx.fillStyle = "#05060f";
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
      ctx.strokeStyle = PALETTE.sky;
      ctx.strokeRect(rect.x + 0.5, rect.y + 0.5, rect.w - 1, rect.h - 1);
      continue;
    }

    if (valueView === "q" && scene.q && type !== "restaurant") {
      // four triangular quadrants colored by Q(s,a)
      const qMax = scene.qMaxAbs ?? maxAbs;
      ACTIONS.forEach((a, ai) => {
        const tri = cellQuadrant(layout, i, a);
        ctx.fillStyle = heatColor(scene.q![i]?.[ai] ?? 0, qMax);
        ctx.beginPath();
        ctx.moveTo(tri[0].x, tri[0].y);
        ctx.lineTo(tri[1].x, tri[1].y);
        ctx.lineTo(tri[2].x, tri[2].y);
        ctx.closePath();
        ctx.fill();
      });
    } else {
      ctx.fillStyle = heatColor(v[i] ?? 0, maxAbs);
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    }
    ctx.strokeStyle = PALETTE.sky;
    ctx.strokeRect(rect.x + 0.5, rect.y + 0.5, rect.w - 1, rect.h - 1);

    drawCellSprite(ctx, rect, type);

    if (valueView === "q" && scene.q && type !== "restaurant") {
      ctx.fillStyle = PALETTE.ink;
      ctx.font = `7px ${PIXEL_FONT}`;
      ctx.textAlign = "center";
      const cx = rect.x + rect.w / 2;
      const cy = rect.y + rect.h / 2;
      ctx.fillText((scene.q[i]?.[0] ?? 0).toFixed(1), cx, rect.y + 10); // up
      ctx.fillText((scene.q[i]?.[2] ?? 0).toFixed(1), cx, rect.y + rect.h - 4); // down
      ctx.fillText((scene.q[i]?.[3] ?? 0).toFixed(1), rect.x + 12, cy + 3); // left
      ctx.fillText((scene.q[i]?.[1] ?? 0).toFixed(1), rect.x + rect.w - 12, cy + 3); // right
    } else if (showValues) {
      ctx.fillStyle = PALETTE.ink;
      ctx.font = `9px ${PIXEL_FONT}`;
      ctx.textAlign = "center";
      ctx.fillText((v[i] ?? 0).toFixed(1), rect.x + rect.w / 2, rect.y + rect.h - 8);
    }

    if (showPolicy && type !== "restaurant") {
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
  let cy = lerp(from.y, to.y, t) + from.h / 2;

  const effect = scene.effect ?? null;
  // manhole fall: sink the character as the effect progresses
  let charScale = 1;
  if (effect && effect.kind === "fall") {
    charScale = 1 - effect.progress;
    cy += effect.progress * 10;
  }
  const halfW = 8 * charScale;
  const bodyH = 20 * charScale;
  ctx.fillStyle = PALETTE.body;
  ctx.fillRect(Math.round(cx - halfW), Math.round(cy - bodyH / 2), Math.round(halfW * 2), Math.round(bodyH));
  ctx.fillStyle = PALETTE.skin;
  ctx.fillRect(Math.round(cx - 6 * charScale), Math.round(cy - bodyH / 2 - 8 * charScale), Math.round(12 * charScale), Math.round(8 * charScale));

  // car-crash effect: a car slides across the row + a burst flashes
  if (effect && effect.kind === "crash") {
    const rect = cellRect(layout, effect.cell);
    const carX = lerp(layout.originX, layout.originX + layout.width, effect.progress);
    const carY = rect.y + rect.h / 2;
    ctx.fillStyle = PALETTE.bad;
    ctx.fillRect(Math.round(carX - 14), Math.round(carY - 8), 28, 16);
    ctx.fillStyle = PALETTE.star;
    ctx.font = `20px ${PIXEL_FONT}`;
    ctx.textAlign = "center";
    if (effect.progress < 0.6) ctx.fillText("✺", cx, cy - 14);
  }

  // floating reward number
  const pop = scene.rewardPop ?? null;
  if (pop) {
    const rect = cellRect(layout, pop.cell);
    const px = rect.x + rect.w / 2;
    const py = rect.y + rect.h / 2 - pop.progress * 28;
    ctx.globalAlpha = Math.max(0, 1 - pop.progress);
    ctx.fillStyle = pop.value >= 0 ? PALETTE.good : PALETTE.bad;
    ctx.font = `12px ${PIXEL_FONT}`;
    ctx.textAlign = "center";
    ctx.fillText(`${pop.value > 0 ? "+" : ""}${pop.value}`, px, py);
    ctx.globalAlpha = 1;
  }
}

function drawCellSprite(
  ctx: CanvasRenderingContext2D,
  rect: CellRect,
  type: World["cells"][number],
): void {
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  if (type === "road" || type === "crosswalk") {
    // dashed center lane line across the cell
    ctx.strokeStyle = "#d9d9d9";
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(rect.x, cy);
    ctx.lineTo(rect.x + rect.w, cy);
    ctx.stroke();
    ctx.setLineDash([]);
    if (type === "crosswalk") {
      ctx.fillStyle = "#f4f4f4";
      for (let s = 0; s < 4; s++) {
        ctx.fillRect(rect.x + 8 + s * 16, rect.y + 6, 8, rect.h - 12);
      }
    }
  } else if (type === "manhole") {
    ctx.fillStyle = "#1a1c2c";
    ctx.beginPath();
    ctx.arc(cx, cy, Math.min(rect.w, rect.h) * 0.28, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#94b0c2";
    ctx.lineWidth = 2;
    ctx.stroke();
  } else if (type === "poutine") {
    ctx.fillStyle = "#a86b32"; // bowl
    ctx.fillRect(cx - 12, cy - 2, 24, 12);
    ctx.fillStyle = "#ffcd75"; // fries
    ctx.fillRect(cx - 10, cy - 10, 20, 8);
  } else if (type === "restaurant") {
    ctx.fillStyle = "#b13e53";
    ctx.fillRect(rect.x + 8, rect.y + 14, rect.w - 16, rect.h - 22);
    ctx.fillStyle = PALETTE.ink;
    ctx.fillRect(rect.x + 6, rect.y + 8, rect.w - 12, 8); // sign
    ctx.fillStyle = PALETTE.accent;
    ctx.font = `7px ${PIXEL_FONT}`;
    ctx.textAlign = "center";
    ctx.fillText("CLAUDETTE", cx, rect.y + 14);
  }
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
