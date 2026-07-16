"use client";

// The console dashboard, built out to the Station instrument panel demonstrated in
// prototype/two-directions.html pane A: a readout of the four figures that matter, the day
// trace signature (docs/10), the hours dial, and a live manifest of what is billable right
// now. Everything is derived from the one Payload the invoice builder already reads, so this
// adds a view, not a second source of truth. It stays synced with Notion through useAfpData:
// a background refetch on focus and on a slow interval, never a webhook or a write.
//
// Scope note per CLAUDE.md: this is still only the AFP hours instrument. No Clients, Work
// Stuff, or Settings sections from the old greenbar prototype get built here until there is
// a reason beyond wanting them.

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Payload } from "@/lib/notion";
import { useAfpData, type AfpError } from "../useAfpData";
import { useCountUp } from "../useCountUp";
import { SyncStatus } from "../SyncStatus";
import { StatusLed } from "../StatusLed";
import { HoursGauge } from "./HoursGauge";
import { DayTrace } from "./DayTrace";
import {
  buildDayTraces,
  dayReadout,
  weekReadout,
  monthReadout,
  unbilled,
  unbilledSessions,
  type Readout,
} from "@/lib/hours";
import { money, shortDate, todayISO } from "@/lib/invoice";

// 60 hours/month, matching the twice-a-month billing cadence CLAUDE.md describes. Not a
// value Notion stores. Change here if it stops fitting how the hours actually run.
const MONTHLY_TARGET_HOURS = 60;

const REST: Readout = { hours: 0, excluded: 0, sessions: 0 };

function StatGauge({
  label,
  value,
  unit,
  sub,
  fill,
  tone,
}: {
  label: string;
  value: number;
  unit: "h" | "$";
  sub: string;
  fill: number;
  tone?: "pri" | "cash";
}) {
  const shown = useCountUp(value);
  return (
    <div className={`g${tone ? " " + tone : ""}`}>
      <span className="lbl">{label}</span>
      <div className="v mono">
        {unit === "$" ? (
          money(shown)
        ) : (
          <>
            {shown.toFixed(2)}
            <i>h</i>
          </>
        )}
      </div>
      <div className="u">{sub}</div>
      <div className="track" aria-hidden="true">
        <div className="fill" style={{ width: `${Math.max(0, Math.min(100, fill))}%` }} />
      </div>
    </div>
  );
}

export function Dashboard({
  initialData,
  initialError,
}: {
  initialData: Payload | null;
  initialError: AfpError | null;
}) {
  const { data, error, lastSynced, refreshing, refresh } = useAfpData(
    initialData,
    initialError
  );

  // Client-only, for two reasons: it keeps the date in the user's local zone rather than the
  // server's UTC, and it avoids a hydration mismatch on the date-derived readouts. Until it
  // resolves after mount the gauges render at rest, which docs/10 explicitly blesses: "An
  // instrument at rest still looks like an instrument."
  const [today, setToday] = useState<string | null>(null);
  const [clock, setClock] = useState<string | null>(null);
  useEffect(() => {
    setToday(todayISO());
    const f = () =>
      setClock(
        new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
      );
    f();
    const id = window.setInterval(f, 15_000);
    return () => window.clearInterval(id);
  }, []);

  const sessions = data?.hours ?? [];
  const day = today ? dayReadout(sessions, today) : REST;
  const week = today ? weekReadout(sessions, today) : REST;
  const month = today ? monthReadout(sessions, today) : REST;
  // Unbilled depends on "today" the same way the readouts do, so it renders at rest until
  // mount and then fills. This also keeps its window identical to the invoice builder's
  // Unbilled preset, which is bounded by today. See lib/hours.unbilledSessions.
  const owed = data && today ? unbilled(data, today) : null;
  const traces = buildDayTraces(sessions);

  const manifest =
    data && today
      ? unbilledSessions(data, today).sort(
          (a, b) => b.date.localeCompare(a.date) || a.sid.localeCompare(b.sid)
        )
      : [];

  const traceSum = traces.reduce((s, d) => s + d.hours, 0);
  const overlapDays = traces.filter((d) => d.hasOverlap).length;

  const fatalError = error && !data;

  return (
    <div className="station">
      <div className="topbar">
        <div className="brand">
          <b>Dashboard</b>
          <span>{data?.client.name ?? "Anytime Fuel Pros"}</span>
        </div>
        <nav className="deck-nav" aria-label="Views">
          <Link href="/dashboard" className="chip on" aria-current="page">
            Dashboard
          </Link>
          <Link href="/" className="chip">
            Invoice Builder
          </Link>
        </nav>
        <div className="deck-status">
          {clock && <span className="deck-clock mono">{clock}</span>}
          <SyncStatus
            lastSynced={lastSynced}
            refreshing={refreshing}
            error={Boolean(error)}
            onRefresh={refresh}
          />
        </div>
      </div>

      <main className="deck">
        {fatalError ? (
          <div className="dash-error">
            <b>Notion read failed.</b>
            <div>{error!.error}</div>
            {error!.hint && <div className="hint">{error!.hint}</div>}
          </div>
        ) : (
          <>
            <section className="gauges" aria-label="Readout">
              <StatGauge
                label="Today"
                value={day.hours}
                unit="h"
                sub={
                  today
                    ? `${day.sessions} session${day.sessions === 1 ? "" : "s"}${
                        day.excluded ? ` · ${day.excluded.toFixed(2)}h off` : ""
                      }`
                    : "standby"
                }
                fill={(day.hours / 8) * 100}
                tone="pri"
              />
              <StatGauge
                label="This week"
                value={week.hours}
                unit="h"
                sub={today ? "since Monday" : "standby"}
                fill={(week.hours / 40) * 100}
              />
              <StatGauge
                label="This month"
                value={month.hours}
                unit="h"
                sub={
                  today
                    ? month.excluded
                      ? `billable · ${month.excluded.toFixed(2)}h excluded`
                      : "billable"
                    : "standby"
                }
                fill={(month.hours / MONTHLY_TARGET_HOURS) * 100}
              />
              <StatGauge
                label="Unbilled"
                value={owed?.amount ?? 0}
                unit="$"
                sub={owed ? `${owed.sessions} sessions · since ${owed.since}` : "standby"}
                fill={((owed?.hours ?? 0) / MONTHLY_TARGET_HOURS) * 100}
                tone="cash"
              />
            </section>

            <section className="mod" aria-label="Day trace">
              <div className="mod-h">
                <span className="eyebrow">Day trace · 00:00 to 24:00 local</span>
                <span className="eyebrow dim">
                  {traces.length} day{traces.length === 1 ? "" : "s"} ·{" "}
                  {traceSum.toFixed(2)}h logged
                  {overlapDays > 0 && ` · ${overlapDays} overlap`}
                </span>
              </div>
              <div className="mod-b">
                <DayTrace traces={traces} today={today ?? ""} />
              </div>
            </section>

            <section className="deck-lower">
              <div className="dial-card">
                <h2 className="eyebrow">Hours this month</h2>
                <HoursGauge hours={month.hours} target={MONTHLY_TARGET_HOURS} />
                <div className="dial-foot mono">
                  {month.hours.toFixed(1)} / {MONTHLY_TARGET_HOURS} h target
                </div>
              </div>

              <div className="mod">
                <div className="mod-h">
                  <span className="eyebrow">Manifest · unbilled</span>
                  <Link href="/" className="chip small">
                    Build invoice
                  </Link>
                </div>
                <div className="manifest-scroll">
                  <table className="manifest">
                    <thead>
                      <tr>
                        <th>Window</th>
                        <th>Task</th>
                        <th className="r">Hrs</th>
                        <th className="r">Amount</th>
                        <th className="r">State</th>
                      </tr>
                    </thead>
                    <tbody>
                      {manifest.length ? (
                        manifest.map((s) => {
                          const titles = s.work
                            .map((id) => data!.workDone[id]?.title)
                            .filter(Boolean)
                            .join(" · ");
                          return (
                            <tr key={s.url}>
                              <td className="t">
                                {shortDate(s.date)} · {s.start}
                                {s.end ? `–${s.end}` : ""}
                              </td>
                              <td className="w">{titles || s.sid}</td>
                              <td className="r hh">{s.hours.toFixed(2)}</td>
                              <td className="r amt">{money(s.hours * s.rate)}</td>
                              <td className="r st">
                                <StatusLed status={s.status} />
                                <span className="statuslabel">{s.status}</span>
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={5} className="manifest-empty">
                            {data && today
                              ? "Nothing unbilled. All caught up."
                              : "Reading Notion…"}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
