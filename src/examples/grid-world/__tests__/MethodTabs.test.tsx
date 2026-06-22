import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MethodTabs, METHOD_LABELS } from "../MethodTabs";

describe("MethodTabs", () => {
  it("renders a button per method and marks the active one", () => {
    render(<MethodTabs value="td0" onChange={() => {}} />);
    expect(screen.getByText(METHOD_LABELS.mc)).toBeTruthy();
    const active = screen.getByText(METHOD_LABELS.td0);
    expect(active.getAttribute("aria-pressed")).toBe("true");
  });

  it("calls onChange with the clicked method", () => {
    const onChange = vi.fn();
    render(<MethodTabs value="td0" onChange={onChange} />);
    fireEvent.click(screen.getByText(METHOD_LABELS.nstep));
    expect(onChange).toHaveBeenCalledWith("nstep");
  });
});

import { GridSettings } from "../GridSettings";
import type { RewardConfig } from "@/shared/rl/gridworld";

const REWARD: RewardConfig = { x1: 0.5, x2: 0.3, r1: 10, r2: 6, r3: 4, r4: 10, stepCost: 0 };

describe("GridSettings", () => {
  it("emits an updated RewardConfig when a field changes", () => {
    const onChange = vi.fn();
    render(<GridSettings reward={REWARD} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("x1"), { target: { value: "0.2" } });
    expect(onChange).toHaveBeenCalledWith({ ...REWARD, x1: 0.2 });
  });
});
