import type { Session } from "@/lib/notion";
import { money } from "@/lib/invoice";
import { byDayDesc, isTerminal } from "@/lib/selection";
import { StatusLed } from "../StatusLed";

export default function SessionManifest({
  days, visible, picked, onToggle,
}: {
  days: string[]; visible: Session[]; picked: Set<string>; onToggle: (url: string) => void;
}) {
  return (
    <div id="ledger">
      {!visible.length ? (
        <p style={{ color: "var(--dim)", fontSize: 12, padding: "8px 2px" }}>
          No sessions in this range.
        </p>
      ) : (
        days.map((day) => {
          const dayRows = [...visible].sort(byDayDesc).filter((r) => r.date === day);
          const dayH = dayRows.reduce((s, r) => s + (picked.has(r.url) ? r.hours : 0), 0);
          return (
            <div className="day" key={day}>
              <div className="day-head">
                <span className="d">{day}</span>
                <span className="h">{dayH ? dayH.toFixed(2) + " h" : "—"}</span>
              </div>
              {dayRows.map((r) => (
                <label
                  className={`sess ${picked.has(r.url) ? "on" : ""} ${isTerminal(r.status) ? "locked" : ""}`}
                  key={r.url}
                >
                  <input type="checkbox" checked={picked.has(r.url)} onChange={() => onToggle(r.url)} />
                  <span>
                    <span className="sid">{r.sid}</span>
                    <span className="meta">
                      <span style={{ flexBasis: "100%" }}>
                        {r.start} – {r.end}{r.location ? " · " + r.location : ""}
                      </span>
                      <StatusLed status={r.status} />
                      <span className="statuslabel">{r.status}</span>
                      {!r.billable && <span className="nobill">· non-billable</span>}
                    </span>
                  </span>
                  <span className="amt">
                    <b>{r.hours.toFixed(2)} h</b>
                    <span>{money(r.hours * r.rate)}</span>
                  </span>
                </label>
              ))}
            </div>
          );
        })
      )}
    </div>
  );
}
