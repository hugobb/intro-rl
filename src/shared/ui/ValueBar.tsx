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
    <div className="value-bar">
      <div className="value-bar__head">
        <span>{label}</span>
        <span>{value.toFixed(2)}</span>
      </div>
      <div className="value-bar__track">
        <div
          className="value-bar__fill"
          data-testid="bar-fill"
          style={{ width: `${pct}%`, background: color }}
        />
        {showTrue && trueValue != null && (
          <div
            className="value-bar__true"
            data-testid="true-marker"
            style={{ left: `${truePct}%` }}
          />
        )}
      </div>
      <div className="value-bar__count">{count} visits</div>
    </div>
  );
}
