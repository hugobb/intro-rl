export const SPEEDS: number[] = [0.5, 1, 2, 5, 10, 25, 50];

export function SpeedSelector({
  value,
  onChange,
}: {
  value: number;
  onChange: (speed: number) => void;
}) {
  return (
    <div className="speed-selector" role="group" aria-label="Speed">
      {SPEEDS.map((s) => (
        <button key={s} aria-pressed={s === value} onClick={() => onChange(s)}>
          {s}×
        </button>
      ))}
    </div>
  );
}
