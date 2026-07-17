// Pure presentational clock control. All state comes in as props so it renders deterministically
// and is checked with renderToStaticMarkup, matching the rest of the cockpit's components.

export type ClockControlViewProps = {
  clockedIn: boolean;
  elapsedLabel: string;
  startLabel: string;
  stale: boolean;
  saving: boolean;
  error: string | null;
  location: string;
  locations: readonly string[];
  onLocation: (v: string) => void;
  onClockIn: () => void;
  onClockOut: () => void;
  onDiscard: () => void;
};

export function ClockControlView(props: ClockControlViewProps) {
  const {
    clockedIn, elapsedLabel, startLabel, stale, saving, error,
    location, locations, onLocation, onClockIn, onClockOut, onDiscard,
  } = props;

  if (!clockedIn) {
    return (
      <div className="clock-control">
        <select
          className="clock-loc"
          aria-label="Location"
          value={location}
          onChange={(e) => onLocation(e.target.value)}
        >
          {locations.map((l) => (
            <option key={l} value={l}>{l}</option>
          ))}
        </select>
        <button className="clock-btn" onClick={onClockIn}>Clock in</button>
      </div>
    );
  }

  return (
    <div className="clock-control">
      <span className="clock-live">
        <span className="clock-dot" aria-hidden="true" />
        <span className="clock-elapsed">{elapsedLabel}</span>
        {startLabel && <span className="clock-since">since {startLabel}</span>}
      </span>
      {stale && <span className="clock-warn">clocked in on a past day</span>}
      <button className="clock-btn" onClick={onClockOut} disabled={saving}>
        {saving ? "Saving..." : "Clock out"}
      </button>
      {stale && <button className="clock-btn" onClick={onDiscard}>Discard</button>}
      {error && <span className="clock-err">{error}</span>}
    </div>
  );
}
