import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { GridWorldExample } from "../GridWorldExample";
import { METHOD_LABELS } from "../MethodTabs";

function renderPage() {
  return render(
    <MemoryRouter>
      <GridWorldExample />
    </MemoryRouter>,
  );
}

describe("GridWorldExample", () => {
  it("mounts with the method tabs and playback controls", () => {
    renderPage();
    expect(screen.getByText(METHOD_LABELS.mc)).toBeTruthy();
    expect(screen.getByLabelText("Grid world animation")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Run one episode" })).toBeTruthy();
  });

  it("advances the episode counter when stepping forward", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Run one episode" }));
    // episode counter is rendered by StateValueTable; after one episode it is >= 1
    expect(screen.getByText(/Episodes:\s*[1-9]/)).toBeTruthy();
  });
});

describe("GridWorldExample v2 controls", () => {
  it("toggles to the Q(s,a) view", () => {
    renderPage();
    const qBtn = screen.getByText("Q(s,a)");
    fireEvent.click(qBtn);
    expect(qBtn.getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByLabelText("Grid world animation")).toBeTruthy();
  });

  it("shows the arrow-key hint and hides the Episode button in Manual mode", () => {
    renderPage();
    fireEvent.click(screen.getByText("Manual (arrow keys)"));
    expect(screen.getByText(/Use arrow keys to move/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Run one episode" })).toBeNull();
  });

  it("shows the return tracker", () => {
    renderPage();
    expect(screen.getByText(/RETURN/)).toBeTruthy();
  });
});
