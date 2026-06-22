export type ValueView = "v" | "q";

const ORDER: { value: ValueView; label: string }[] = [
  { value: "v", label: "V(s)" },
  { value: "q", label: "Q(s,a)" },
];

export function ValueViewTabs({
  value,
  onChange,
}: {
  value: ValueView;
  onChange: (v: ValueView) => void;
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
