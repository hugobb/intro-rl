import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PlaybackControls } from "../PlaybackControls";

describe("PlaybackControls", () => {
  it("wires every button", () => {
    const fns = {
      onStepBack: vi.fn(),
      onStepForward: vi.fn(),
      onTogglePlay: vi.fn(),
      onReset: vi.fn(),
    };
    render(<PlaybackControls isPlaying={false} {...fns} />);
    fireEvent.click(screen.getByRole("button", { name: /step back/i }));
    fireEvent.click(screen.getByRole("button", { name: /step forward/i }));
    fireEvent.click(screen.getByRole("button", { name: /play/i }));
    fireEvent.click(screen.getByRole("button", { name: /reset/i }));
    expect(fns.onStepBack).toHaveBeenCalled();
    expect(fns.onStepForward).toHaveBeenCalled();
    expect(fns.onTogglePlay).toHaveBeenCalled();
    expect(fns.onReset).toHaveBeenCalled();
  });

  it("shows Pause while playing", () => {
    render(
      <PlaybackControls
        isPlaying
        onStepBack={() => {}}
        onStepForward={() => {}}
        onTogglePlay={() => {}}
        onReset={() => {}}
      />,
    );
    expect(screen.getByRole("button", { name: /pause/i })).toBeInTheDocument();
  });
});
