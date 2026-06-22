export function ReturnTracker({
  current,
  last,
}: {
  current: number;
  last: number | null;
}) {
  return (
    <div className="flex items-center gap-4 bg-panel px-3 py-2 font-pixel text-[12px] text-accent">
      <span>RETURN {formatScore(current)}</span>
      <span className="text-ink">LAST {last === null ? "—" : formatScore(last)}</span>
    </div>
  );
}

function formatScore(n: number): string {
  const rounded = Math.round(n);
  const sign = rounded < 0 ? "-" : "";
  return `${sign}${String(Math.abs(rounded)).padStart(4, "0")}`;
}
