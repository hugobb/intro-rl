import type { Method } from "@/shared/rl/td-estimators";

export const METHOD_LABELS: Record<Method, string> = {
  mc: "Monte Carlo",
  td0: "TD(0)",
  nstep: "n-step TD",
};

const ORDER: Method[] = ["mc", "td0", "nstep"];

export function MethodTabs({
  value,
  onChange,
}: {
  value: Method;
  onChange: (m: Method) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5" role="tablist">
      {ORDER.map((m) => (
        <button key={m} aria-pressed={m === value} onClick={() => onChange(m)}>
          {METHOD_LABELS[m]}
        </button>
      ))}
    </div>
  );
}
