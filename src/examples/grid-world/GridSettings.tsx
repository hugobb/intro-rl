import type { RewardConfig } from "@/shared/rl/gridworld";

interface Field {
  key: keyof RewardConfig;
  label: string;
  min: number;
  max: number;
  step: number;
}

const FIELDS: Field[] = [
  { key: "x1", label: "x1", min: 0, max: 1, step: 0.05 },
  { key: "x2", label: "x2", min: 0, max: 1, step: 0.05 },
  { key: "r1", label: "r1", min: 0, max: 100, step: 1 },
  { key: "r2", label: "r2", min: 0, max: 100, step: 1 },
  { key: "r3", label: "r3", min: 0, max: 100, step: 1 },
  { key: "r4", label: "r4", min: 0, max: 100, step: 1 },
  { key: "stepCost", label: "step cost", min: 0, max: 10, step: 0.1 },
];

const HINTS: Record<keyof RewardConfig, string> = {
  x1: "accident probability (off-crosswalk road)",
  x2: "manhole fall probability",
  r1: "accident penalty (applied as -r1)",
  r2: "manhole penalty (applied as -r2)",
  r3: "poutine reward",
  r4: "restaurant (terminal) reward",
  stepCost: "per-step cost (applied as -stepCost)",
};

export function GridSettings({
  reward,
  onChange,
}: {
  reward: RewardConfig;
  onChange: (r: RewardConfig) => void;
}) {
  return (
    <div className="grid gap-2 text-[11px]">
      {FIELDS.map((f) => (
        <label key={f.key} className="flex items-center justify-between gap-3">
          <span title={HINTS[f.key]}>
            {f.label} — {HINTS[f.key]}
          </span>
          <input
            type="number"
            aria-label={f.label}
            className="w-[72px] border-2 border-ink bg-bg px-1 text-ink"
            min={f.min}
            max={f.max}
            step={f.step}
            value={reward[f.key]}
            onChange={(e) =>
              onChange({ ...reward, [f.key]: Number(e.target.value) })
            }
          />
        </label>
      ))}
    </div>
  );
}
