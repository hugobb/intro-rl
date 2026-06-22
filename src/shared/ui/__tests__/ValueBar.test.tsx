import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ValueBar } from "../ValueBar";

describe("ValueBar", () => {
  it("shows the label, value, and count", () => {
    render(
      <ValueBar label="A" value={2.5} max={3} count={4} color="#fff" showTrue={false} />,
    );
    expect(screen.getByText("A")).toBeInTheDocument();
    expect(screen.getByText("2.50")).toBeInTheDocument();
    expect(screen.getByText("4 visits")).toBeInTheDocument();
  });

  it("renders the fill width proportional to value/max", () => {
    render(
      <ValueBar label="A" value={1.5} max={3} count={0} color="#fff" showTrue={false} />,
    );
    const fill = screen.getByTestId("bar-fill");
    expect(fill.style.width).toBe("50%");
  });

  it("renders the true-value marker only when showTrue", () => {
    const { rerender } = render(
      <ValueBar label="A" value={1} max={3} count={0} color="#fff" showTrue={false} trueValue={2.5} />,
    );
    expect(screen.queryByTestId("true-marker")).toBeNull();
    rerender(
      <ValueBar label="A" value={1} max={3} count={0} color="#fff" showTrue trueValue={2.5} />,
    );
    expect(screen.getByTestId("true-marker")).toBeInTheDocument();
  });
});
