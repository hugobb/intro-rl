export interface CanvasDims {
  width: number;
  height: number;
}

/**
 * Size a canvas's backing store for crisp pixel rendering on high-DPR displays.
 * Only the backing store (canvas.width/height) is set — the display size is left
 * to CSS (e.g. Tailwind `w-full h-auto`) so the canvas scales responsively via its
 * intrinsic aspect ratio while staying crisp at the backing resolution.
 */
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
  return { width, height };
}
