export interface CanvasDims {
  width: number;
  height: number;
}

/** Size a canvas for crisp pixel rendering on high-DPR displays. */
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
  canvas.style.width = `${cssWidth}px`;
  canvas.style.height = `${cssHeight}px`;
  return { width, height };
}
