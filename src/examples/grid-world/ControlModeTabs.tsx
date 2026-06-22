export type ControlMode = "policy" | "manual";

const ORDER: { value: ControlMode; label: string }[] = [
  { value: "policy", label: "Auto (policy)" },
  { value: "manual", label: "Manual (arrow keys)" },
];

export function ControlModeTabs({
  value,
  onChange,
}: {
  value: ControlMode;
  onChange: (v: ControlMode) => void;
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
