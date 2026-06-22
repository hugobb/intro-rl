import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PolicyTabs } from "../PolicyTabs";

describe("PolicyTabs", () => {
  it("renders the four policies", () => {
    render(<PolicyTabs value="random" onChange={() => {}} />);
    for (const name of ["Random", "Greedy", "Optimistic Init", "ε-Greedy"]) {
      expect(screen.getByRole("button", { name })).toBeInTheDocument();
    }
  });

  it("calls onChange with the policy kind", () => {
    const onChange = vi.fn();
    render(<PolicyTabs value="random" onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "ε-Greedy" }));
    expect(onChange).toHaveBeenCalledWith("epsilon-greedy");
  });
});
