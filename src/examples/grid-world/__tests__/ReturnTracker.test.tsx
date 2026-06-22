import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ReturnTracker } from "../ReturnTracker";

describe("ReturnTracker", () => {
  it("shows the current return and last return", () => {
    render(<ReturnTracker current={6} last={2} />);
    expect(screen.getByText(/RETURN/)).toBeTruthy();
    expect(screen.getByText(/6/)).toBeTruthy();
    expect(screen.getByText(/LAST/)).toBeTruthy();
    expect(screen.getByText(/2/)).toBeTruthy();
  });
  it("shows a dash for last when null", () => {
    render(<ReturnTracker current={0} last={null} />);
    expect(screen.getByText(/LAST/)).toBeTruthy();
    expect(screen.getByText(/—/)).toBeTruthy();
  });
});
