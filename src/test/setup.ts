import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

// jsdom doesn't implement the <canvas> 2D context — its getContext throws
// "Not implemented". Return null instead so canvas-drawing components hit their
// `if (!ctx) return` guard and degrade gracefully (their pure logic is tested
// separately). Keeps test output pristine.
vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
