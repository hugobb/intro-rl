import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ValueViewTabs } from "../ValueViewTabs";
import { PolicyTypeTabs } from "../PolicyTypeTabs";
import { ControlModeTabs } from "../ControlModeTabs";

describe("ValueViewTabs", () => {
  it("marks the active view and fires onChange", () => {
    const onChange = vi.fn();
    render(<ValueViewTabs value="v" onChange={onChange} />);
    expect(screen.getByText("V(s)").getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(screen.getByText("Q(s,a)"));
    expect(onChange).toHaveBeenCalledWith("q");
  });
});

describe("PolicyTypeTabs", () => {
  it("fires onChange with the clicked policy type", () => {
    const onChange = vi.fn();
    render(<PolicyTypeTabs value="deterministic" onChange={onChange} />);
    fireEvent.click(screen.getByText("ε-soft"));
    expect(onChange).toHaveBeenCalledWith("epsilon");
  });
});

describe("ControlModeTabs", () => {
  it("fires onChange with the clicked control mode", () => {
    const onChange = vi.fn();
    render(<ControlModeTabs value="policy" onChange={onChange} />);
    fireEvent.click(screen.getByText("Manual (arrow keys)"));
    expect(onChange).toHaveBeenCalledWith("manual");
  });
});
