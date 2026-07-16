"use client";

// The instrument cluster: the four readouts and the full-width day trace, lifted from the
// dashboard so the cockpit can sit them across the top of one screen. Pure derivation from the
// single Payload, rendered at rest until "today" resolves after mount, which docs/10 blesses:
// an instrument at rest still looks like an instrument.

import type { Payload } from "@/lib/notion";
import { useCountUp } from "../useCountUp";
import { DayTrace } from "../dashboard/DayTrace";
import {
  buildDayTraces,
  dayReadout,
  weekReadout,
  monthReadout,
  unbilled,
  type Readout,
} from "@/lib/hours";
import { money } from "@/lib/invoice";

export const MONTHLY_TARGET_HOURS = 60;
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

export default function InstrumentCluster({
  data,
  today,
}: {
  data: Payload | null;
  today: string | null;
}) {
  const sessions = data?.hours ?? [];
  const day = today ? dayReadout(sessions, today) : REST;
  const week = today ? weekReadout(sessions, today) : REST;
  const month = today ? monthReadout(sessions, today) : REST;
  const owed = data && today ? unbilled(data, today) : null;
  const traces = buildDayTraces(sessions);
  const traceSum = traces.reduce((s, d) => s + d.hours, 0);
  const overlapDays = traces.filter((d) => d.hasOverlap).length;

  return (
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
    </>
  );
}
