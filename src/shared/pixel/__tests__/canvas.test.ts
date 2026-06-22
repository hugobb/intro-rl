import { describe, it, expect } from "vitest";
import { fitCanvas } from "../canvas";

describe("fitCanvas", () => {
  it("scales the backing store by dpr and sets css size", () => {
    const canvas = document.createElement("canvas");
    const dims = fitCanvas(canvas, 320, 180, 2);
    expect(dims).toEqual({ width: 640, height: 360 });
    expect(canvas.width).toBe(640);
    expect(canvas.height).toBe(360);
    expect(canvas.style.width).toBe("320px");
    expect(canvas.style.height).toBe("180px");
  });
});
