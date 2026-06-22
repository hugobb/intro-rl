import { describe, it, expect } from "vitest";
import { fitCanvas } from "../canvas";

describe("fitCanvas", () => {
  it("scales the backing store by dpr and leaves display size to CSS", () => {
    const canvas = document.createElement("canvas");
    const dims = fitCanvas(canvas, 320, 180, 2);
    expect(dims).toEqual({ width: 640, height: 360 });
    expect(canvas.width).toBe(640);
    expect(canvas.height).toBe(360);
    // display size is controlled by CSS, not inline styles
    expect(canvas.style.width).toBe("");
    expect(canvas.style.height).toBe("");
  });
});
