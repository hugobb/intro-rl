import type { PolicyKind } from "@/shared/rl/policies";

export const POLICY_LABELS: Record<PolicyKind, string> = {
  random: "Random",
  greedy: "Greedy",
  optimistic: "Optimistic Init",
  "epsilon-greedy": "ε-Greedy",
};

const ORDER: PolicyKind[] = ["random", "greedy", "optimistic", "epsilon-greedy"];

export function PolicyTabs({
  value,
  onChange,
}: {
  value: PolicyKind;
  onChange: (kind: PolicyKind) => void;
}) {
  return (
    <div className="policy-tabs" role="tablist">
      {ORDER.map((kind) => (
        <button
          key={kind}
          className={kind === value ? "active" : ""}
          aria-pressed={kind === value}
          onClick={() => onChange(kind)}
        >
          {POLICY_LABELS[kind]}
        </button>
      ))}
    </div>
  );
}
