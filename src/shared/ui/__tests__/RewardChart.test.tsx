import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { RewardChart } from "../RewardChart";
import type { RunData } from "../chart";

const run = (id: number, label: string): RunData => ({
  id,
  label,
  color: "#fff",
  arms: [0, 1, 0],
  rewards: [3, 1, 2],
  optimalArm: 0,
});

const base = {
  liveRun: null,
  selectedId: null,
  onSelect: () => {},
  onDelete: () => {},
  metric: "total-reward" as const,
  onMetricChange: () => {},
};

describe("RewardChart", () => {
  it("lists saved runs in the legend", () => {
    render(<RewardChart {...base} savedRuns={[run(1, "Run 1 · Greedy")]} />);
    expect(screen.getByRole("button", { name: /^Run 1 · Greedy/ })).toBeInTheDocument();
  });

  it("calls onSelect and onDelete with the run id", () => {
    const onSelect = vi.fn();
    const onDelete = vi.fn();
    render(
      <RewardChart
        {...base}
        savedRuns={[run(2, "Run 2 · Random")]}
        onSelect={onSelect}
        onDelete={onDelete}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /^Run 2 · Random/ }));
    expect(onSelect).toHaveBeenCalledWith(2);
    fireEvent.click(screen.getByRole("button", { name: /^Delete Run 2 · Random/ }));
    expect(onDelete).toHaveBeenCalledWith(2);
  });

  it("changes the metric via the selector", () => {
    const onMetricChange = vi.fn();
    render(<RewardChart {...base} savedRuns={[]} onMetricChange={onMetricChange} />);
    fireEvent.change(screen.getByRole("combobox", { name: /chart metric/i }), {
      target: { value: "optimal-pct" },
    });
    expect(onMetricChange).toHaveBeenCalledWith("optimal-pct");
  });

  it("shows an empty hint when there are no runs", () => {
    render(<RewardChart {...base} savedRuns={[]} />);
    expect(screen.getByText(/Run the sim to plot/)).toBeInTheDocument();
  });
});
