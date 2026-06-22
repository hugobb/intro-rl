export function PlaybackControls({
  isPlaying,
  onStepBack,
  onStepForward,
  onTogglePlay,
  onReset,
}: {
  isPlaying: boolean;
  onStepBack: () => void;
  onStepForward: () => void;
  onTogglePlay: () => void;
  onReset: () => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label="Playback">
      <button onClick={onStepBack} aria-label="Step back">
        ◀ Back
      </button>
      <button onClick={onTogglePlay} aria-label={isPlaying ? "Pause" : "Play"}>
        {isPlaying ? "❚❚ Pause" : "▶ Play"}
      </button>
      <button onClick={onStepForward} aria-label="Step forward">
        Step ▶
      </button>
      <button onClick={onReset} aria-label="Reset">
        ⟲ Reset
      </button>
    </div>
  );
}
