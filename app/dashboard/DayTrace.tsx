"use client";

// The signature element, docs/10-visual-direction.md: "The single most valuable element and
// the reason to build Station rather than Depth." Each day is a 24-hour band, midnight to
// midnight, with worked segments lit in amber, non-billable in grey, and a --hot hairline
// for the current time on today's row. It surfaces what the app has and shows nowhere else:
// where a day fragmented, when real work started, and above all whether two billable
// sessions overlap, which is a billing error you cannot otherwise see.
//
// Geometry comes from lib/hours.buildDayTraces (pure). The only thing computed here is the
// live "now" position, done client-side after mount so the server and client markup agree.

import { useEffect, useState } from "react";
import type { DayTrace as Trace } from "@/lib/hours";
import { shortDate } from "@/lib/invoice";

const dow = (iso: string): string => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d)
    .toLocaleDateString("en-US", { weekday: "short" })
    .toUpperCase();
};

export function DayTrace({ traces, today }: { traces: Trace[]; today: string }) {
  const [nowPct, setNowPct] = useState<number | null>(null);

  useEffect(() => {
    const compute = () => {
      const t = new Date();
      setNowPct(((t.getHours() * 60 + t.getMinutes()) / 1440) * 100);
    };
    compute();
    // The now hairline drifts a minute at a time. A slow tick keeps it honest without a
    // per-frame loop, and it drops out with everything else under reduced motion since it
    // is a position, not an animation.
    const id = window.setInterval(compute, 30_000);
    return () => window.clearInterval(id);
  }, []);

  if (!traces.length) {
    return <div className="trace-empty">No sessions logged in range.</div>;
  }

  return (
    <div className="tracewrap">
      {traces.map((day, rowIdx) => (
        <div className="trace" key={day.date}>
          <span className="d" title={day.date}>
            {shortDate(day.date)}
            <i>{dow(day.date)}</i>
          </span>
          <div className="band">
            <span className="mid" aria-hidden="true" />
            {day.segments.map((seg, i) => (
              <span
                key={i}
                className={`seg${seg.billable ? "" : " nb"}${seg.overlap ? " ov" : ""}`}
                style={{
                  left: `${seg.leftPct}%`,
                  width: `${seg.widthPct}%`,
                  // Bounded one-shot reveal, staggered per row. Pure CSS, drops under
                  // reduced motion via the global rule in globals.css.
                  animationDelay: `${rowIdx * 45}ms`,
                }}
                title={seg.label}
              />
            ))}
            {day.date === today && nowPct !== null && (
              <span className="now" style={{ left: `${nowPct}%` }} aria-hidden="true" />
            )}
          </div>
          <span className={`h${day.hasOverlap ? " warn" : ""}`}>
            {day.hours.toFixed(2)}
            {day.hasOverlap && (
              <i className="ovflag" title="Two billable sessions overlap on this day">
                overlap
              </i>
            )}
          </span>
        </div>
      ))}
      <div className="ruler" aria-hidden="true">
        <span />
        <div className="ticks">
          <span>00</span>
          <span>06</span>
          <span>12</span>
          <span>18</span>
          <span>24</span>
        </div>
        <span />
      </div>
    </div>
  );
}
