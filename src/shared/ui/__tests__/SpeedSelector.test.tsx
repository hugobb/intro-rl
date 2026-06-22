import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SpeedSelector, SPEEDS } from "../SpeedSelector";

describe("SpeedSelector", () => {
  it("renders all speed options", () => {
    render(<SpeedSelector value={1} onChange={() => {}} />);
    for (const s of SPEEDS) {
      expect(screen.getByRole("button", { name: `${s}×` })).toBeInTheDocument();
    }
  });

  it("marks the active speed as pressed", () => {
    render(<SpeedSelector value={5} onChange={() => {}} />);
    expect(screen.getByRole("button", { name: "5×" })).toHaveAttribute("aria-pressed", "true");
  });

  it("calls onChange with the chosen speed", () => {
    const onChange = vi.fn();
    render(<SpeedSelector value={1} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "10×" }));
    expect(onChange).toHaveBeenCalledWith(10);
  });

  it("exposes the required speed set", () => {
    expect(SPEEDS).toEqual([0.5, 1, 2, 5, 10, 25, 50]);
  });
});
