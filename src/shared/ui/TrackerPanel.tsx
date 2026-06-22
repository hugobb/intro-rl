import { ValueBar } from "./ValueBar";
import { STORE_COLORS } from "@/shared/pixel/palette";

export function TrackerPanel({
  names,
  q,
  counts,
  trueValues,
  showTrue,
  max,
  step,
}: {
  names: string[];
  q: number[];
  counts: number[];
  trueValues: number[];
  showTrue: boolean;
  max: number;
  step: number;
}) {
  return (
    <div className="mt-4 grid gap-3">
      <div className="text-accent">Step: {step}</div>
      {names.map((name, i) => (
        <ValueBar
          key={name}
          label={name}
          value={q[i]}
          max={max}
          count={counts[i]}
          color={STORE_COLORS[i % STORE_COLORS.length]}
          showTrue={showTrue}
          trueValue={trueValues[i]}
        />
      ))}
    </div>
  );
}
