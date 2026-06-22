export function EventLog({ entries }: { entries: string[] }) {
  return (
    <div className="event-log">
      <h3>Event Log</h3>
      <ol reversed>
        {entries
          .slice()
          .reverse()
          .map((e, i) => (
            <li key={entries.length - i}>{e}</li>
          ))}
      </ol>
    </div>
  );
}
