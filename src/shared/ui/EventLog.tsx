export function EventLog({ entries }: { entries: string[] }) {
  return (
    <div className="h-full max-h-[470px] overflow-auto bg-panel p-2">
      <h3 className="mb-1 text-[11px]">Event Log</h3>
      <ol reversed className="m-0 list-none p-0">
        {entries
          .slice()
          .reverse()
          .map((e, i) => (
            <li key={entries.length - i} className="text-[10px] leading-snug">
              {e}
            </li>
          ))}
      </ol>
    </div>
  );
}
