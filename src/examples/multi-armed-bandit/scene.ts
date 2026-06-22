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
