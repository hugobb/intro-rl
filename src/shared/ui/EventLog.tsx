import { useEffect, useRef } from "react";

export function EventLog({ entries }: { entries: string[] }) {
  const listRef = useRef<HTMLOListElement | null>(null);

  // Keep the newest entry (at the bottom) in view as the log grows.
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [entries]);

  return (
    <div className="flex h-full flex-col bg-panel p-2">
      <h3 className="mb-1 shrink-0 text-[11px]">Event Log</h3>
      <ol ref={listRef} className="m-0 min-h-0 flex-1 list-none overflow-auto p-0">
        {entries.map((e, i) => (
          <li key={i} className="text-[10px] leading-snug">
            {e}
          </li>
        ))}
      </ol>
    </div>
  );
}
