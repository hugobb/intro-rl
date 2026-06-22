export function StateValueTable({
  states,
  labels,
  v,
  vTrue,
  showTrue,
  episode,
  rms,
}: {
  states: number[];
  labels: string[]; // parallel to states
  v: number[];
  vTrue: number[];
  showTrue: boolean;
  episode: number;
  rms: number;
}) {
  return (
    <div className="bg-panel p-2 text-[10px]">
      <div className="mb-1 flex justify-between">
        <span>Episodes: {episode}</span>
        {showTrue && <span>RMS error: {rms.toFixed(3)}</span>}
      </div>
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className="text-left">State</th>
            <th className="text-right">V est</th>
            {showTrue && <th className="text-right">V true</th>}
            {showTrue && <th className="text-right">|err|</th>}
          </tr>
        </thead>
        <tbody>
          {states.map((s, i) => (
            <tr key={s}>
              <td className="text-left">{labels[i]}</td>
              <td className="text-right">{(v[s] ?? 0).toFixed(2)}</td>
              {showTrue && <td className="text-right">{(vTrue[s] ?? 0).toFixed(2)}</td>}
              {showTrue && (
                <td className="text-right">
                  {Math.abs((v[s] ?? 0) - (vTrue[s] ?? 0)).toFixed(2)}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
