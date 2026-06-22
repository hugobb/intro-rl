import type { Restaurant } from "@/examples/multi-armed-bandit/simulation";
import { trueMean } from "@/shared/rl/reward";

export function SettingsPanel({
  restaurants,
  onChange,
}: {
  restaurants: Restaurant[];
  onChange: (next: Restaurant[]) => void;
}) {
  const setProb = (ri: number, pi: number, raw: string) => {
    const v = Math.max(0, Math.min(1, Number(raw) || 0));
    const next = restaurants.map((r, i) => {
      if (i !== ri) return r;
      const dist: [number, number, number] = [r.dist[0], r.dist[1], r.dist[2]];
      dist[pi] = v;
      return { ...r, dist };
    });
    onChange(next);
  };
  return (
    <div className="mt-4 bg-panel p-3">
      <h3 className="text-[11px]">True distributions</h3>
      <p className="text-[10px]">
        P(1★), P(2★), P(3★) per restaurant. (Should sum to 1.)
      </p>
      {restaurants.map((r, ri) => (
        <div key={r.name} className="my-1.5 flex items-center gap-2">
          <span>{r.name}</span>
          {[0, 1, 2].map((pi) => (
            <input
              key={pi}
              type="number"
              step="0.05"
              min="0"
              max="1"
              className="w-[60px] border-2 border-ink bg-bg px-1 text-ink"
              value={r.dist[pi]}
              aria-label={`${r.name} P(${pi + 1} star)`}
              onChange={(e) => setProb(ri, pi, e.target.value)}
            />
          ))}
          <span>mean {trueMean(r.dist).toFixed(2)}</span>
        </div>
      ))}
    </div>
  );
}
