export type PolicyType = "deterministic" | "epsilon";

const ORDER: { value: PolicyType; label: string }[] = [
  { value: "deterministic", label: "Deterministic" },
  { value: "epsilon", label: "ε-soft" },
];

export function PolicyTypeTabs({
  value,
  onChange,
}: {
  value: PolicyType;
  onChange: (v: PolicyType) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5" role="tablist">
      {ORDER.map((o) => (
        <button
          key={o.value}
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
