export function ValueBar({
  label,
  value,
  max,
  count,
  color,
  showTrue,
  trueValue,
}: {
  label: string;
  value: number;
  max: number;
  count: number;
  color: string;
  showTrue: boolean;
  trueValue?: number;
}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const truePct =
    trueValue != null ? Math.max(0, Math.min(100, (trueValue / max) * 100)) : 0;
  return (
    <div>
      <div className="flex justify-between">
        <span>{label}</span>
        <span>{value.toFixed(2)}</span>
      </div>
      <div className="relative h-[18px] border-2 border-ink bg-panel">
        <div
          className="h-full"
          data-testid="bar-fill"
          style={{ width: `${pct}%`, background: color }}
        />
        {showTrue && trueValue != null && (
          <div
            className="absolute -top-[3px] -bottom-[3px] w-[3px] bg-ink"
            data-testid="true-marker"
            style={{ left: `${truePct}%` }}
          />
        )}
      </div>
      <div className="text-[10px] text-mid">{count} visits</div>
    </div>
  );
}
