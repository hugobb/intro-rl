import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { RewardChart } from "../RewardChart";
import type { RewardRun } from "../chart";

const run = (id: number, label: string): RewardRun => ({
  id,
  label,
  color: "#fff",
  cumulative: [0, 2, 5],
});

describe("RewardChart", () => {
  it("lists saved runs in the legend", () => {
    render(
      <RewardChart
        savedRuns={[run(1, "Run 1 · Greedy")]}
        liveRun={null}
        selectedId={null}
        onSelect={() => {}}
        onDelete={() => {}}
      />,
    );
    expect(screen.getByRole("button", { name: /^Run 1 · Greedy/ })).toBeInTheDocument();
  });

  it("calls onSelect and onDelete with the run id", () => {
    const onSelect = vi.fn();
    const onDelete = vi.fn();
    render(
      <RewardChart
        savedRuns={[run(2, "Run 2 · Random")]}
        liveRun={null}
        selectedId={null}
        onSelect={onSelect}
        onDelete={onDelete}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /^Run 2 · Random/ }));
    expect(onSelect).toHaveBeenCalledWith(2);
    fireEvent.click(screen.getByRole("button", { name: /^Delete Run 2 · Random/ }));
    expect(onDelete).toHaveBeenCalledWith(2);
  });

  it("shows an empty hint when there are no runs", () => {
    render(
      <RewardChart
        savedRuns={[]}
        liveRun={null}
        selectedId={null}
        onSelect={() => {}}
        onDelete={() => {}}
      />,
    );
    expect(screen.getByText(/Run the sim to plot reward/)).toBeInTheDocument();
  });
});
