// src/examples/grid-world/__tests__/ConvergenceChart.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ConvergenceChart } from "../ConvergenceChart";

describe("ConvergenceChart", () => {
  it("renders a labeled canvas and a legend entry per line", () => {
    render(
      <ConvergenceChart
        lines={[
          { label: "TD(0)", color: "#41a6f6", series: [3, 2, 1] },
          { label: "MC", color: "#38b764", series: [3, 1.5, 0.5] },
        ]}
      />,
    );
    expect(screen.getByLabelText("Convergence chart")).toBeTruthy();
    expect(screen.getByText("TD(0)")).toBeTruthy();
    expect(screen.getByText("MC")).toBeTruthy();
  });

  it("renders without throwing when there are no lines", () => {
    render(<ConvergenceChart lines={[]} />);
    expect(screen.getByLabelText("Convergence chart")).toBeTruthy();
  });
});
