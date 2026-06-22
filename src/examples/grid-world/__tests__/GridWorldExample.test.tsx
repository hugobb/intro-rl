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
