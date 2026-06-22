// src/examples/grid-world/__tests__/ConvergenceChart.test.tsx
import { describe, it, expect } from "vitest";
import { vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { fireEvent } from "@testing-library/react";
import { ConvergenceChart } from "../ConvergenceChart";
import { RMS_METRIC_LABELS } from "../ConvergenceChart";

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

describe("ConvergenceChart metric selector", () => {
  it("renders the three RMS metric options and fires onMetricChange", () => {
    const onMetricChange = vi.fn();
    render(
      <ConvergenceChart
        lines={[{ label: "TD(0)", color: "#41a6f6", series: [3, 2, 1] }]}
        metric="path"
        onMetricChange={onMetricChange}
      />,
    );
    expect(screen.getByText(RMS_METRIC_LABELS.path)).toBeTruthy();
    expect(screen.getByText(RMS_METRIC_LABELS.visited)).toBeTruthy();
    fireEvent.click(screen.getByText(RMS_METRIC_LABELS.all));
    expect(onMetricChange).toHaveBeenCalledWith("all");
  });
});
